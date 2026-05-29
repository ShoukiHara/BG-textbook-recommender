"""Google Sheets → Supabase 移行スクリプト"""
import argparse
import sys
import psycopg2
import gspread
from oauth2client.service_account import ServiceAccountCredentials


def parse_args():
    parser = argparse.ArgumentParser(description="Google Sheets → Supabase 移行スクリプト")
    parser.add_argument("--credentials", required=True, help="サービスアカウントJSONのパス")
    parser.add_argument("--spreadsheet-id", required=True, help="Google SpreadsheetのID")
    parser.add_argument("--database-url", required=True, help="PostgreSQL接続URL (postgresql://...)")
    parser.add_argument("--dry-run", action="store_true", help="実際にはINSERTせず件数確認のみ")
    return parser.parse_args()


def load_sheets(credentials_path: str, spreadsheet_id: str):
    scope = [
        "https://spreadsheets.google.com/feeds",
        "https://www.googleapis.com/auth/drive",
    ]
    creds = ServiceAccountCredentials.from_json_keyfile_name(credentials_path, scope)
    client = gspread.authorize(creds)
    spreadsheet = client.open_by_key(spreadsheet_id)

    instructors_ws = spreadsheet.worksheet("instructors")
    books_ws = spreadsheet.worksheet("books")
    reviews_ws = spreadsheet.worksheet("reviews")

    return (
        instructors_ws.get_all_records(),
        books_ws.get_all_records(),
        reviews_ws.get_all_records(),
    )


def migrate(args):
    print("Google Sheets からデータを読み込み中...")
    instructors_rows, books_rows, reviews_rows = load_sheets(
        args.credentials, args.spreadsheet_id
    )

    print(f"  instructors: {len(instructors_rows)} 件")
    print(f"  books:       {len(books_rows)} 件")
    print(f"  reviews:     {len(reviews_rows)} 件")

    if args.dry_run:
        print("\n[dry-run] 実際のINSERTは行いません。")
        return

    conn = psycopg2.connect(args.database_url)
    try:
        with conn:
            with conn.cursor() as cur:
                # 1. instructors 移行
                name_to_uuid: dict[str, str] = {}
                ins_count = 0
                ins_skip = 0
                for row in instructors_rows:
                    name = str(row.get("name", "")).strip()
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
                old_id_to_uuid: dict[str, str] = {}
                book_count = 0
                book_skip = 0
                for row in books_rows:
                    old_id = str(row.get("id", "")).strip()
                    title = str(row.get("title", "")).strip()
                    subject = str(row.get("subject", "")).strip()
                    if not title or not subject:
                        continue
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
                for row in reviews_rows:
                    old_book_id = str(row.get("book_id", "")).strip()
                    instructor_name = str(row.get("instructor_name", "")).strip()
                    layer_raw = row.get("layer", "")
                    rating_raw = row.get("rating", "")
                    comment = str(row.get("comment", "") or "")

                    book_uuid = old_id_to_uuid.get(old_book_id)
                    if not book_uuid:
                        print(f"  [SKIP] book_id={old_book_id} が見つかりません", file=sys.stderr)
                        rev_skip += 1
                        continue

                    instructor_uuid = name_to_uuid.get(instructor_name) if instructor_name else None

                    try:
                        layer = int(layer_raw)
                        rating = int(float(str(rating_raw)))
                    except (ValueError, TypeError):
                        print(f"  [SKIP] layer/rating が不正: {row}", file=sys.stderr)
                        rev_skip += 1
                        continue

                    cur.execute(
                        """INSERT INTO reviews (book_id, instructor_id, layer, rating, comment)
                           VALUES (%s, %s, %s, %s, %s)""",
                        (book_uuid, instructor_uuid, layer, rating, comment),
                    )
                    rev_count += 1

        print(f"\n移行完了:")
        print(f"  instructors: {ins_count} 件移行")
        print(f"  books:       {book_count} 件移行")
        print(f"  reviews:     {rev_count} 件移行")
        print(f"  スキップ:     {ins_skip + book_skip + rev_skip} 件（重複）")

    except Exception as e:
        conn.rollback()
        print(f"\nエラーが発生しました。ロールバックします: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    args = parse_args()
    migrate(args)
