ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS weekly_days jsonb NOT NULL DEFAULT '[]'::jsonb;
