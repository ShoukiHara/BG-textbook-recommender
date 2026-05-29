# BG参考書データベース — リライト実装仕様書

> Claude Code への指示書。この仕様書に従い、既存の Streamlit アプリを React + FastAPI + Supabase 構成へフルリライトする。

---

## 0. 前提・ゴール

| 項目 | 内容 |
|---|---|
| 既存実装 | Python / Streamlit + Google Sheets |
| リライト後 | React (Vite) + FastAPI + Supabase (PostgreSQL) |
| フロントデプロイ | Vercel |
| バックエンドデプロイ | Railway |
| 認証 | 管理者画面のみパスワード認証（JWT）。一般・講師画面は認証なし |

---

## 1. 技術スタック

### フロントエンド
```
React 18 + TypeScript
Vite
React Router v6
TanStack Query (React Query) v5
shadcn/ui + Tailwind CSS v3
axios
```

### バックエンド
```
Python 3.12
FastAPI
Pydantic v2
SQLAlchemy 2.0 (async)  ※ asyncpg ドライバ
python-jose  (JWT)
passlib[bcrypt]
google-generativeai
httpx
```

### インフラ・外部サービス
```
Supabase  (PostgreSQL ホスティング)
Vercel    (フロントエンド)
Railway   (バックエンド + 環境変数管理)
Gemini API (google-generativeai)
```

---

## 2. ディレクトリ構成

```
repo-root/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/          # shadcn/ui 自動生成
│   │   │   ├── BookCard.tsx
│   │   │   ├── RankingList.tsx
│   │   │   ├── ReviewForm.tsx
│   │   │   └── StarRating.tsx
│   │   ├── pages/
│   │   │   ├── StudentDiagnosis.tsx   # 生徒用AIリコメンド診断
│   │   │   ├── StudentBookList.tsx    # 生徒用参考書一覧
│   │   │   ├── BookDetail.tsx         # 参考書詳細
│   │   │   ├── InstructorInput.tsx    # 講師用データ入力
│   │   │   └── AdminPanel.tsx         # 管理者画面
│   │   ├── hooks/
│   │   │   ├── useBooks.ts
│   │   │   ├── useReviews.ts
│   │   │   ├── useInstructors.ts
│   │   │   └── useAuth.ts
│   │   ├── lib/
│   │   │   ├── api.ts        # axios インスタンス + API 関数
│   │   │   └── constants.ts  # SUBJECTS, LAYERS 定数
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── routers/
│   │   │   ├── books.py
│   │   │   ├── reviews.py
│   │   │   ├── instructors.py
│   │   │   ├── ranking.py
│   │   │   ├── ai.py
│   │   │   └── auth.py
│   │   ├── models.py       # SQLAlchemy ORM モデル
│   │   ├── schemas.py      # Pydantic スキーマ
│   │   ├── database.py     # 非同期 DB セッション
│   │   ├── logic.py        # ランキング計算・AI呼び出し（既存移植）
│   │   └── main.py         # FastAPI app, CORS, ルーター登録
│   ├── migrations/
│   │   └── 001_initial.sql # 初期スキーマ（§3 参照）
│   ├── scripts/
│   │   └── migrate_from_sheets.py  # Google Sheets → Supabase 移行スクリプト（§7 参照）
│   ├── requirements.txt
│   └── Dockerfile
│
└── README.md
```

---

## 3. データベーススキーマ (Supabase / PostgreSQL)

Supabase のダッシュボード SQL エディタ、または `migrations/001_initial.sql` として実行する。

```sql
-- 講師マスタ
create table instructors (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

-- 参考書マスタ
create table books (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  subject    text not null,
  created_at timestamptz not null default now(),
  unique(title, subject)
);

-- レビュー
-- instructor_id は SET NULL: 講師削除時にレビューを匿名化して残す
create table reviews (
  id            uuid primary key default gen_random_uuid(),
  book_id       uuid not null references books(id) on delete cascade,
  instructor_id uuid          references instructors(id) on delete set null,
  layer         int  not null check (layer in (1, 2, 3)),
  rating        int  not null check (rating >= 0 and rating <= 5),
  comment       text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index on reviews(book_id);
create index on reviews(instructor_id);

-- updated_at 自動更新トリガー
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger reviews_updated_at
  before update on reviews
  for each row execute function update_updated_at();
```

### ドメイン定数

```python
# backend/app/logic.py および frontend/src/lib/constants.ts で共有
SUBJECTS = [
    "英語", "文系数学", "理系数学", "現代文", "古文", "漢文",
    "物理", "化学", "生物", "日本史", "世界史", "地理", "倫理・政治経済"
]

LAYERS = {
    1: "予習・初学フェーズ",
    2: "基礎力完成フェーズ (地方国公立ゴール)",
    3: "応用・発展フェーズ (阪大以上ゴール)"
}
```

---

## 4. 環境変数

### バックエンド (`backend/.env` / Railway 環境変数)

```env
DATABASE_URL=postgresql+asyncpg://user:password@host:5432/dbname
ADMIN_PASSWORD_HASH=<bcrypt hash of admin password>
JWT_SECRET=<random 32+ char string>
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=480
GEMINI_API_KEY=<Gemini API key>
CORS_ORIGINS=https://your-app.vercel.app,http://localhost:5173
```

`ADMIN_PASSWORD_HASH` の生成:
```python
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"])
print(pwd_context.hash("your-admin-password"))
```

### フロントエンド (`frontend/.env.local` / Vercel 環境変数)

```env
VITE_API_BASE_URL=https://your-backend.railway.app
```

---

## 5. API 仕様

ベースURL: `/api/v1`

### 5-1. 認証

| Method | Path | 説明 |
|---|---|---|
| POST | `/auth/login` | 管理者ログイン → JWT 返却 |

**POST `/auth/login`**
```json
// Request
{ "password": "string" }

// Response 200
{ "access_token": "string", "token_type": "bearer" }

// Response 401
{ "detail": "Invalid password" }
```

以降の管理者専用エンドポイントは `Authorization: Bearer <token>` ヘッダー必須。

---

### 5-2. 参考書

| Method | Path | 認証 | 説明 |
|---|---|---|---|
| GET | `/books` | 不要 | 一覧取得（科目フィルタ・ソート対応）|
| GET | `/books/{book_id}` | 不要 | 1件取得 |
| POST | `/books` | 不要（講師） | 新規登録 |

**GET `/books`** クエリパラメータ:
- `subject` (optional): 科目名で絞り込み
- `sort` (optional): `title` / `rating` / `review_count`（デフォルト: `title`）
- `reviewed_only` (optional): `true` のときレビューのある本のみ

**POST `/books`** リクエスト:
```json
{ "title": "string", "subject": "string" }
```
- `subject` が `"文理共通数学"` のとき、`"文系数学"` と `"理系数学"` の 2 件を同時登録する
- 重複（同タイトル・同科目）の場合は `409 Conflict`

---

### 5-3. レビュー

| Method | Path | 認証 | 説明 |
|---|---|---|---|
| GET | `/books/{book_id}/reviews` | 不要 | 特定本のレビュー一覧 |
| POST | `/books/{book_id}/reviews` | 不要（講師） | レビュー投稿 |
| PATCH | `/reviews/{review_id}` | 管理者 | レビュー編集 |
| DELETE | `/reviews/{review_id}` | 管理者 | レビュー削除 |

**POST `/books/{book_id}/reviews`** リクエスト:
```json
{
  "instructor_id": "uuid",
  "layer": 1,
  "rating": 4,
  "comment": "string"
}
```

**PATCH `/reviews/{review_id}`** リクエスト:
```json
{
  "layer": 1,
  "rating": 4,
  "comment": "string"
}
```

---

### 5-4. 講師

| Method | Path | 認証 | 説明 |
|---|---|---|---|
| GET | `/instructors` | 不要 | 全講師一覧 |
| POST | `/instructors` | 管理者 | 講師追加 |
| DELETE | `/instructors/{instructor_id}` | 管理者 | 講師削除（レビューは匿名化） |

---

### 5-5. ランキング

| Method | Path | 認証 | 説明 |
|---|---|---|---|
| GET | `/ranking` | 不要 | 科目×レイヤーのランキング取得 |

**GET `/ranking`** クエリパラメータ:
- `subject` (必須): 科目名
- `layer` (必須): 1 / 2 / 3

レスポンス:
```json
[
  {
    "rank": 1,
    "book_id": "uuid",
    "title": "string",
    "score": 4.23,
    "avg_rating": 4.1,
    "review_count": 7
  }
]
```

ランキングスコア算出ロジック（既存 `logic.py` の `calculate_ranking` をそのまま移植）:
- 講師の重み = `log10(その講師の累計レビュー数 + 10)`
- スコア = 重み付き平均評価
- 降順ソート、TOP 10 を返す

---

### 5-6. AI 機能

| Method | Path | 認証 | 説明 |
|---|---|---|---|
| POST | `/ai/diagnose` | 不要 | 生徒情報からレイヤー診断 |
| GET | `/ai/book-guide/{book_id}` | 不要 | 参考書 AI ガイド生成 |

**POST `/ai/diagnose`** リクエスト:
```json
{
  "subject": "英語",
  "grade": "高3",
  "target_university": "京都大学",
  "mock_score": "偏差値65",
  "current_books": "システム英単語 完了",
  "worry": "長文読解が遅い"
}
```

レスポンス:
```json
{ "layer": 2, "reason": "string" }
```

**GET `/ai/book-guide/{book_id}`**
- そのbookのレビュー全件を取得し Gemini に要約させる
- レビューが 0 件の場合: `{ "guide": "まだレビューがありません。" }`

---

## 6. 画面・機能仕様

### 6-1. 生徒用：AIリコメンド診断 (`/`)

- タブ切り替え: 「AIに診断してもらう」 / 「自分でレベルを指定する」
- **AIタブ**: 学年・志望校・模試成績・使用参考書・悩みを入力 → `POST /ai/diagnose` → レイヤー判定結果を表示 → `GET /ranking` でランキング表示
- **手動タブ**: 科目・レイヤーをセレクト → `GET /ranking` でランキング表示
- ランキング表示: 1〜3位はメダル色バッジ（金・銀・銅）、各書籍から詳細ページへ遷移
- 診断結果テキストのダウンロードボタン（`.txt`）

### 6-2. 生徒用：参考書一覧 (`/books`)

- 科目フィルタ（セレクト）
- 並び替え: タイトル順 / 評価高い順 / レビュー多い順
- 「レビューのある本のみ」チェックボックス
- 各書籍カードから詳細ページへ遷移

### 6-3. 参考書詳細 (`/books/:bookId`)

- タイトル・科目バッジ表示
- Amazon / 楽天の検索リンクボタン（URLエンコードして生成、外部リンク）
- AIガイド表示（`GET /ai/book-guide/:bookId`、ローディング表示あり）
- 「この参考書にコメントをする」ボタン → 講師入力画面へ遷移（`?bookId=xxx` クエリ付き）
- レビュー一覧: 講師名（削除済み講師は「匿名」表示）、レイヤー、星評価、コメント
- 同じ科目の他の参考書（最大5件）

### 6-4. 講師用：データ入力 (`/instructor`)

タブ切り替え: 「レビューの投稿」 / 「参考書の登録」

**レビュー投稿タブ**:
- 科目セレクト → その科目の本一覧をセレクト（`GET /books?subject=xxx`）
- 講師セレクト（`GET /instructors`）
- レイヤー選択（ラジオ）
- 星評価（0〜5）
- コメントテキストエリア（テンプレート文字列プリセット）
- マークダウンプレビュー（リアルタイム）
- 投稿ボタン → `POST /books/:bookId/reviews`

**参考書登録タブ**:
- 科目セレクト（「文理共通数学」オプションあり）
- 登録済み本の一覧表示（アコーディオン）
- タイトル入力 → リアルタイム重複候補表示（`GET /books` からフロント側フィルタ）
- 登録ボタン → `POST /books`

### 6-5. 管理者画面 (`/admin`)

- パスワード入力フォーム → `POST /auth/login` → JWT をメモリ（`useState`）に保持
  - `localStorage` は使わない（セキュリティ上の理由）
  - ページリロードでログアウト（再入力）
- 認証後:
  - 全レビューの DataTable 表示
  - レビュー編集・削除フォーム
  - 講師マスタ管理（追加・削除）
  - ログアウトボタン

---

## 7. Google Sheets → Supabase 移行スクリプト

`backend/scripts/migrate_from_sheets.py` として実装する。

### 前提
- `gspread` + `oauth2client` で Sheets を読み取る
- Supabase には `psycopg2` で直接接続する（SQLAlchemy 不使用、シンプルに）

### 実行手順

```bash
cd backend
pip install gspread oauth2client psycopg2-binary
python scripts/migrate_from_sheets.py \
  --credentials path/to/service_account.json \
  --spreadsheet-id <Google SpreadsheetのID> \
  --database-url postgresql://user:password@host:5432/dbname
```

### スクリプトの処理フロー

```
1. Google Sheets の 3 シート（books / reviews / instructors）を読み込む

2. instructors シートを移行
   - name をキーに INSERT、重複はスキップ
   - 旧 name → 新 uuid のマッピング辞書を作成

3. books シートを移行
   - (title, subject) をキーに INSERT、重複はスキップ
   - 旧 book_id（整数）→ 新 uuid のマッピング辞書を作成

4. reviews シートを移行
   - 旧 book_id → 新 book_uuid に変換
   - 旧 instructor_name → 新 instructor_uuid に変換
     ※ 名前が instructors テーブルに存在しない場合は instructor_id = NULL（匿名）
   - layer, rating を int に変換
   - comment の NaN は空文字に変換

5. 完了後、件数サマリーを標準出力に表示
   例:
     instructors: 12 件移行
     books:       87 件移行
     reviews:    203 件移行
     スキップ:     3 件（重複）
```

### エラーハンドリング
- 1 件でも DB 書き込みに失敗した場合はロールバックしてエラー内容を表示する
- `--dry-run` オプションを実装し、実際には INSERT せず件数だけ確認できるようにする

---

## 8. バックエンド実装メモ

### `backend/app/main.py` の骨格

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import books, reviews, instructors, ranking, ai, auth
import os

app = FastAPI(title="BG参考書DB API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ["CORS_ORIGINS"].split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,        prefix="/api/v1/auth")
app.include_router(books.router,       prefix="/api/v1/books")
app.include_router(reviews.router,     prefix="/api/v1")
app.include_router(instructors.router, prefix="/api/v1/instructors")
app.include_router(ranking.router,     prefix="/api/v1/ranking")
app.include_router(ai.router,          prefix="/api/v1/ai")
```

### 管理者認証ミドルウェア

```python
# app/auth.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

security = HTTPBearer()

def require_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("role") != "admin":
            raise HTTPException(status_code=403)
    except JWTError:
        raise HTTPException(status_code=401)
```

### レビュー取得時の講師名解決

`instructor_id` が NULL のレビューは、フロント・バック双方で講師名を `"匿名"` として返す。

```python
# schemas.py
class ReviewOut(BaseModel):
    id: UUID
    instructor_name: str  # NULLのとき "匿名"
    layer: int
    rating: int
    comment: str
    created_at: datetime
```

```python
# routers/reviews.py （SQLAlchemy クエリ例）
from sqlalchemy import select, func, coalesce, literal

stmt = (
    select(
        Review,
        coalesce(Instructor.name, literal("匿名")).label("instructor_name")
    )
    .outerjoin(Instructor, Review.instructor_id == Instructor.id)
    .where(Review.book_id == book_id)
)
```

---

## 9. フロントエンド実装メモ

### React Router v6 ルーティング

```tsx
// App.tsx
<Routes>
  <Route path="/"           element={<StudentDiagnosis />} />
  <Route path="/books"      element={<StudentBookList />} />
  <Route path="/books/:id"  element={<BookDetail />} />
  <Route path="/instructor" element={<InstructorInput />} />
  <Route path="/admin"      element={<AdminPanel />} />
</Routes>
```

### TanStack Query キャッシュ戦略

```ts
// 参考書一覧: 5分キャッシュ（変更頻度低）
useQuery({ queryKey: ['books', subject], staleTime: 5 * 60 * 1000 })

// ランキング: 10分キャッシュ（計算コスト高）
useQuery({ queryKey: ['ranking', subject, layer], staleTime: 10 * 60 * 1000 })

// AI診断・AIガイド: キャッシュなし（毎回リクエスト）
useQuery({ queryKey: ['ai-guide', bookId], staleTime: 0 })
```

### 管理者 JWT の保持

```tsx
// JWTはlocalStorageに保存しない。コンポーネントのstateで管理。
const [token, setToken] = useState<string | null>(null);
// ページリロードでログアウト状態に戻る（意図的な設計）
```

---

## 10. デプロイ手順

### Supabase
1. Supabase プロジェクト作成
2. `migrations/001_initial.sql` を SQL エディタで実行
3. Settings → Database → Connection string（Pooler / Transaction mode）を取得 → `DATABASE_URL` に設定

### Railway（バックエンド）
1. GitHub リポジトリを Railway に接続（`backend/` ディレクトリ指定）
2. `Dockerfile` を使ってデプロイ
3. 環境変数を §4 に従って設定
4. デプロイ後、生成されたドメインを `VITE_API_BASE_URL` および Supabase の許可リストに追加

### Vercel（フロントエンド）
1. GitHub リポジトリを Vercel に接続（`frontend/` ディレクトリ指定）
2. Build command: `vite build`、Output directory: `dist`
3. 環境変数 `VITE_API_BASE_URL` を設定
4. デプロイ後、生成されたドメインをバックエンドの `CORS_ORIGINS` に追加

### データ移行
```bash
# 全件確認（dry-run）
python scripts/migrate_from_sheets.py --dry-run ...

# 本番移行
python scripts/migrate_from_sheets.py ...
```
