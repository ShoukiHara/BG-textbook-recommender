alter table ai_diagnosis_feedback add column if not exists english_weak_areas jsonb not null default '[]';
alter table ai_diagnosis_feedback add column if not exists math_weak_areas jsonb not null default '[]';
alter table ai_diagnosis_feedback add column if not exists science_weak_areas jsonb not null default '[]';
