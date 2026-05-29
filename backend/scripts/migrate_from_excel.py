"""Excel (streamlit_db.xlsx) → Supabase 移行スクリプト

comment フィールドを4つのテキストフィールドに分解してインポートする。
既存レビュー（同一 book + instructor + layer）はスキップ。
"""
import argparse
import re
import sys
import os
import pandas as pd
import psycopg2
from dotenv import load_dotenv

# .env を自動ロード（スクリプトの親ディレクトリにある .env を優先）
_script_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_script_dir, "..", ".env"))


def _url_to_kwargs(db_url: str) -> dict:
    """接続 URL をパースして psycopg2.connect() のキーワード引数辞書に変換する。
    パスワード中の特殊文字（%、@、# など）を安全に扱うため URL 文字列を避ける。"""
    from urllib.parse import unquote

    url = db_url.strip()
    for prefix in ("postgresql+asyncpg://", "postgresql://", "postgres://"):
        if url.startswith(prefix):
            url = url[len(prefix):]
            break

    at_pos = url.rfind("@")
    credentials = url[:at_pos]
    host_db = url[at_pos + 1:]

    colon_pos = credentials.index(":")
    user = unquote(credentials[:colon_pos])
    password = unquote(credentials[colon_pos + 1:])

    slash_pos = host_db.index("/")
    host_port = host_db[:slash_pos]
    dbname = host_db[slash_pos + 1:]

    if ":" in host_port:
        host, port_str = host_port.rsplit(":", 1)
        port = int(port_str)
    else:
        host = host_port
        port = 5432

    return dict(host=host, port=port, dbname=dbname, user=user, password=password)


def parse_comment(comment: str) -> dict:
    """コメント文字列を4フィールドに分解する。

    各セクションヘッダーの開始位置と終了位置を特定し、
    隣接するヘッダーの間のテキストを各フィールドに割り当てる。
    """
    result = {"period": "", "before_connection": "", "after_connection": "", "usage_feel": ""}
    if not comment:
        return result

    section_patterns = [
        ("period",            r"・使用していた時期と期間[^：:]*[：:]"),
        ("before_connection", r"・この参考書をやる前[^：:]+[：:]"),
        ("after_connection",  r"・この参考書の後[^：:]+[：:]"),
        ("usage_feel",        r"・使用感[^：:]*[：:]"),
    ]

    # (header_start, content_start, field) を収集してソート
    hits: list[tuple[int, int, str]] = []
    for field, pattern in section_patterns:
        m = re.search(pattern, comment)
        if m:
            hits.append((m.start(), m.end(), field))
    hits.sort()

    if not hits:
        result["usage_feel"] = comment.strip()
        return result

    for i, (header_start, content_start, field) in enumerate(hits):
        next_header_start = hits[i + 1][0] if i + 1 < len(hits) else len(comment)
        result[field] = comment[content_start:next_header_start].strip()

    return result


def parse_args():
    parser = argparse.ArgumentParser(description="Excel → Supabase 移行スクリプト")
    parser.add_argument("--excel", required=True, help="Excelファイルのパス")
    parser.add_argument("--database-url", default=None, help="PostgreSQL接続URL (省略時は .env の DATABASE_URL を使用)")
    parser.add_argument("--dry-run", action="store_true", help="件数確認のみ（実際にはINSERTしない）")
    return parser.parse_args()


def migrate(args):
    print(f"Excelファイルを読み込み中: {args.excel}")
    xl = pd.ExcelFile(args.excel)
    instructors_df = pd.read_excel(xl, "instructors")
    books_df = pd.read_excel(xl, "books")
    reviews_df = pd.read_excel(xl, "reviews")

    print(f"  instructors: {len(instructors_df)} 件")
    print(f"  books:       {len(books_df)} 件")
    print(f"  reviews:     {len(reviews_df)} 件")

    if args.dry_run:
        print("\n[dry-run] 実際のINSERTは行いません。")
        return

    db_url = args.database_url or os.environ.get("DATABASE_URL", "")
    if not db_url:
        print("エラー: --database-url か .env の DATABASE_URL が必要です", file=sys.stderr)
        sys.exit(1)

    conn = psycopg2.connect(**_url_to_kwargs(db_url))
    try:
        with conn:
            with conn.cursor() as cur:
                # 1. instructors 移行
                name_to_uuid: dict[str, str] = {}
                ins_count = 0
                ins_skip = 0
                for _, row in instructors_df.iterrows():
                    name = str(row["instructor_name"]).strip()
                    if not name:
                        continue
                    cur.execute("SELECT id FROM instructors WHERE name = %s", (name,))
                    existing = cur.fetchone()
                    if existing:
                        name_to_uuid[name] = str(existing[0])
                        ins_skip += 1
                        continue
                    cur.execute(
                        "INSERT INTO instructors (name) VALUES (%s) RETURNING id",
                        (name,),
                    )
                    new_id = str(cur.fetchone()[0])
                    name_to_uuid[name] = new_id
                    ins_count += 1

                # 2. books 移行
                old_id_to_uuid: dict[int, str] = {}
                book_count = 0
                book_skip = 0
                for _, row in books_df.iterrows():
                    old_id = int(row["book_id"])
                    title = str(row["title"]).strip()
                    subject = str(row["subject"]).strip()
                    cur.execute(
                        "SELECT id FROM books WHERE title = %s AND subject = %s",
                        (title, subject),
                    )
                    existing = cur.fetchone()
                    if existing:
                        old_id_to_uuid[old_id] = str(existing[0])
                        book_skip += 1
                        continue
                    cur.execute(
                        "INSERT INTO books (title, subject) VALUES (%s, %s) RETURNING id",
                        (title, subject),
                    )
                    new_id = str(cur.fetchone()[0])
                    old_id_to_uuid[old_id] = new_id
                    book_count += 1

                # 3. reviews 移行
                rev_count = 0
                rev_skip = 0
                parse_ok = 0
                parse_fallback = 0
                for _, row in reviews_df.iterrows():
                    old_book_id = int(row["book_id"])
                    instructor_name = str(row.get("instructor_name", "") or "").strip()
                    comment = str(row.get("comment", "") or "")
                    if comment == "nan":
                        comment = ""

                    book_uuid = old_id_to_uuid.get(old_book_id)
                    if not book_uuid:
                        print(f"  [SKIP] book_id={old_book_id} が見つかりません", file=sys.stderr)
                        rev_skip += 1
                        continue

                    instructor_uuid = name_to_uuid.get(instructor_name)

                    try:
                        layer = int(row["layer"])
                        rating = int(float(str(row["rating"])))
                    except (ValueError, TypeError):
                        print(f"  [SKIP] layer/rating が不正: {row}", file=sys.stderr)
                        rev_skip += 1
                        continue

                    # 既存レビューを検索（同一 book + instructor + layer）
                    cur.execute(
                        """SELECT id, period, before_connection, after_connection, usage_feel
                           FROM reviews
                           WHERE book_id = %s
                             AND instructor_id IS NOT DISTINCT FROM %s
                             AND layer = %s
                           LIMIT 1""",
                        (book_uuid, instructor_uuid, layer),
                    )
                    existing = cur.fetchone()

                    # comment を 4 フィールドに分解
                    fields = parse_comment(comment)
                    if fields["usage_feel"] == comment.strip() and comment.strip():
                        parse_fallback += 1
                    elif any(fields.values()):
                        parse_ok += 1

                    if existing:
                        existing_id = existing[0]
                        has_content = any(existing[1:])  # period〜usage_feel のどれかに値があれば skip
                        if has_content:
                            rev_skip += 1
                            continue
                        # 既存行が空 → UPDATE
                        cur.execute(
                            """UPDATE reviews
                               SET period = %s, before_connection = %s,
                                   after_connection = %s, usage_feel = %s
                               WHERE id = %s""",
                            (
                                fields["period"], fields["before_connection"],
                                fields["after_connection"], fields["usage_feel"],
                                existing_id,
                            ),
                        )
                    else:
                        cur.execute(
                            """INSERT INTO reviews
                               (book_id, instructor_id, layer, rating,
                                period, before_connection, after_connection, usage_feel)
                               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                            (
                                book_uuid, instructor_uuid, layer, rating,
                                fields["period"], fields["before_connection"],
                                fields["after_connection"], fields["usage_feel"],
                            ),
                        )
                    rev_count += 1

        print(f"\n移行完了:")
        print(f"  instructors: {ins_count} 件移行 (スキップ: {ins_skip} 件)")
        print(f"  books:       {book_count} 件移行 (スキップ: {book_skip} 件)")
        print(f"  reviews:     {rev_count} 件移行 (スキップ: {rev_skip} 件)")
        print(f"    うちパース成功: {parse_ok} 件 / フォールバック: {parse_fallback} 件")

    except Exception as e:
        conn.rollback()
        print(f"\nエラーが発生しました。ロールバックします: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    args = parse_args()
    migrate(args)
