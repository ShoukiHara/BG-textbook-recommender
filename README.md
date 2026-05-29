# BG参考書データベース

React + FastAPI + Supabase 構成の参考書リコメンダーアプリ。

## ディレクトリ構成

```
├── frontend/   React (Vite + TypeScript + Tailwind CSS)
├── backend/    FastAPI + SQLAlchemy (async) + Supabase
└── SPEC.md     実装仕様書
```

## セットアップ

### バックエンド

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env  # 環境変数を設定
uvicorn app.main:app --reload
```

環境変数（`backend/.env`）を設定してください:
- `DATABASE_URL` — Supabase の PostgreSQL 接続URL (asyncpg)
- `ADMIN_PASSWORD_HASH` — `passlib` で生成した bcrypt ハッシュ
- `JWT_SECRET` — 32文字以上のランダム文字列
- `GEMINI_API_KEY` — Google AI Studio で取得

```python
# ADMIN_PASSWORD_HASH の生成
from passlib.context import CryptContext
print(CryptContext(schemes=["bcrypt"]).hash("your-password"))
```

### データベース初期化

Supabase SQL エディタで `backend/migrations/001_initial.sql` を実行。

### フロントエンド

```bash
cd frontend
npm install
cp .env.local.example .env.local  # VITE_API_BASE_URL を設定
npm run dev
```

### データ移行（Google Sheets → Supabase）

```bash
cd backend
pip install gspread oauth2client psycopg2-binary
# dry-run 確認
python scripts/migrate_from_sheets.py \
  --credentials path/to/service_account.json \
  --spreadsheet-id <ID> \
  --database-url postgresql://... \
  --dry-run
# 本番実行
python scripts/migrate_from_sheets.py ...
```

## デプロイ

- **フロントエンド**: Vercel（`frontend/` ディレクトリ指定）
- **バックエンド**: Railway（`backend/Dockerfile` 使用）
- **DB**: Supabase（PostgreSQL）
