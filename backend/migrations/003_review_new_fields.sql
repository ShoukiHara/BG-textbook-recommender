ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS explanation_quality    TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS problem_volume         TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS strengthens_weaknesses TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS target_deviation       TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS completion_period      TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS self_study_suitability TEXT NOT NULL DEFAULT '';
