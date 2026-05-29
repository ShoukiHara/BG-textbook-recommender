-- AI診断フィードバック
create table ai_diagnosis_feedback (
  id               uuid primary key default gen_random_uuid(),

  -- 診断入力（分析に使う）
  subject          text not null,
  grade            text not null,
  target_department text not null default '',
  mock_score       text not null default '',
  books_history    text not null default '',
  weak_points      text not null default '',
  learning_style   text not null default '',

  -- 診断結果
  diagnosed_layer  int  not null check (diagnosed_layer in (1, 2, 3)),
  diagnosis_reason text not null default '',
  recommended_books jsonb not null default '[]',

  -- フィードバック
  score            int  not null check (score >= 1 and score <= 10),
  feedback_comment text not null default '',

  created_at       timestamptz not null default now()
);

create index on ai_diagnosis_feedback(subject);
create index on ai_diagnosis_feedback(score);
create index on ai_diagnosis_feedback(diagnosed_layer);
