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
