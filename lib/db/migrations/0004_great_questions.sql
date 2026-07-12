CREATE TABLE IF NOT EXISTS "great_question_profiles" (
  "id" serial PRIMARY KEY,
  "child_id" integer NOT NULL REFERENCES "children"("id") ON DELETE CASCADE,
  "domain_key" text NOT NULL,
  "domain_label" text NOT NULL,
  "selected_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_great_question_profile_child" ON "great_question_profiles"("child_id");

CREATE TABLE IF NOT EXISTS "great_question_sessions" (
  "id" serial PRIMARY KEY,
  "child_id" integer NOT NULL REFERENCES "children"("id") ON DELETE CASCADE,
  "session_date" date NOT NULL,
  "domain_key" text NOT NULL,
  "domain_label" text NOT NULL,
  "scenario" text NOT NULL,
  "status" text NOT NULL DEFAULT 'in_progress',
  "child_message_count" integer NOT NULL DEFAULT 0,
  "reward_points" integer NOT NULL DEFAULT 0,
  "evaluation" jsonb,
  "transaction_id" integer REFERENCES "transactions"("id") ON DELETE SET NULL,
  "started_at" timestamptz NOT NULL DEFAULT now(),
  "completed_at" timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_great_question_child_date" ON "great_question_sessions"("child_id", "session_date");
CREATE INDEX IF NOT EXISTS "idx_great_question_child_status" ON "great_question_sessions"("child_id", "status");

CREATE TABLE IF NOT EXISTS "great_question_messages" (
  "id" serial PRIMARY KEY,
  "session_id" integer NOT NULL REFERENCES "great_question_sessions"("id") ON DELETE CASCADE,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
