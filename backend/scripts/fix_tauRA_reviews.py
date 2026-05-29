"""
田浦義仁講師のレビューが匿名になってしまった問題を修復するスクリプト。

streamlit_db.xlsx の reviews シートから田浦義仁のレビューを読み込み、
DBの匿名レビュー（instructor_id IS NULL）と
  書籍タイトル × 科目 × レイヤー × 評価
で照合して instructor_id を更新する。

使い方:
  cd backend
  python scripts/fix_tauRA_reviews.py [--dry-run]
"""

import argparse
import sys
import os
import pandas as pd
import psycopg2
from urllib.parse import urlparse, unquote

XLSX_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "streamlit_db.xlsx")
INSTRUCTOR_NAME = "田浦義仁"


def get_pg_connect_kwargs(asyncpg_url: str) -> dict:
    """asyncpg URL を psycopg2.connect() のキーワード引数辞書に変換する。"""
    url = asyncpg_url.replace("postgresql+asyncpg://", "postgresql://")
    parsed = urlparse(url)
    return {
        "host": parsed.hostname,
        "port": parsed.port or 5432,
        "dbname": parsed.path.lstrip("/"),
        "user": unquote(parsed.username or ""),
        "password": unquote(parsed.password or ""),
    }


def load_excel(path: str):
    books_df = pd.read_excel(path, sheet_name="books")
    reviews_df = pd.read_excel(path, sheet_name="reviews")
    return books_df, reviews_df


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="実際には更新しない")
    args = parser.parse_args()

    # .env から DATABASE_URL を読む
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    db_url = None
    with open(env_path) as f:
        for line in f:
            if line.startswith("DATABASE_URL="):
                db_url = line.strip().split("=", 1)[1]
                break
    if not db_url:
        print("ERROR: DATABASE_URL が .env に見つかりません")
        sys.exit(1)

    pg_kwargs = get_pg_connect_kwargs(db_url)

    # Excel 読み込み
    books_df, reviews_df = load_excel(XLSX_PATH)
    tauRA_reviews = reviews_df[reviews_df["instructor_name"] == INSTRUCTOR_NAME].copy()
    print(f"Excel 上の {INSTRUCTOR_NAME} のレビュー数: {len(tauRA_reviews)}")
    if tauRA_reviews.empty:
        print("対象レビューが見つかりません。終了します。")
        sys.exit(0)

    # book_id(整数) → title, subject を結合
    tauRA_reviews = tauRA_reviews.merge(
        books_df[["book_id", "title", "subject"]],
        on="book_id",
        how="left",
    )

    conn = psycopg2.connect(**pg_kwargs)
    cur = conn.cursor()

    # 田浦義仁の instructor.id を取得（なければ作成）
    cur.execute("SELECT id FROM instructors WHERE name = %s", (INSTRUCTOR_NAME,))
    row = cur.fetchone()
    if row:
        instructor_uuid = row[0]
        print(f"講師 UUID: {instructor_uuid}")
    else:
        print(f"講師「{INSTRUCTOR_NAME}」がDBに存在しません。作成します。")
        cur.execute(
            "INSERT INTO instructors (name) VALUES (%s) RETURNING id",
            (INSTRUCTOR_NAME,),
        )
        instructor_uuid = cur.fetchone()[0]
        print(f"作成した講師 UUID: {instructor_uuid}")

    updated = 0
    skipped = 0

    for _, xls_row in tauRA_reviews.iterrows():
        title = xls_row["title"]
        subject = xls_row["subject"]
        layer = int(xls_row["layer"])
        rating = int(xls_row["rating"])

        # DB から対応する匿名レビューを検索
        cur.execute(
            """
            SELECT r.id
            FROM reviews r
            JOIN books b ON b.id = r.book_id
            WHERE b.title = %s
              AND b.subject = %s
              AND r.layer = %s
              AND r.rating = %s
              AND r.instructor_id IS NULL
            LIMIT 1
            """,
            (title, subject, layer, rating),
        )
        match = cur.fetchone()

        if match:
            review_id = match[0]
            if args.dry_run:
                print(f"  [DRY-RUN] UPDATE reviews SET instructor_id={instructor_uuid} WHERE id={review_id}  ({title} / {subject} / L{layer} / ★{rating})")
            else:
                cur.execute(
                    "UPDATE reviews SET instructor_id = %s WHERE id = %s",
                    (instructor_uuid, review_id),
                )
            updated += 1
        else:
            print(f"  [SKIP] 対応する匿名レビューが見つかりません: {title} / {subject} / L{layer} / ★{rating}")
            skipped += 1

    if not args.dry_run:
        conn.commit()
        print(f"\n完了: {updated}件更新, {skipped}件スキップ")
    else:
        conn.rollback()
        print(f"\n[DRY-RUN] 更新予定: {updated}件, スキップ: {skipped}件")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
