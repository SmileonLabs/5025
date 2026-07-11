ALTER TABLE "children" ADD COLUMN IF NOT EXISTS "grade" integer;
ALTER TABLE "children" ADD COLUMN IF NOT EXISTS "reading_level" text NOT NULL DEFAULT 'normal';
ALTER TABLE "children" ADD COLUMN IF NOT EXISTS "ai_answer_length" text NOT NULL DEFAULT 'normal';
ALTER TABLE "children" ADD COLUMN IF NOT EXISTS "explain_difficult_words" boolean NOT NULL DEFAULT true;
ALTER TABLE "children" ADD COLUMN IF NOT EXISTS "daily_reading_retry_limit" integer NOT NULL DEFAULT 3;

ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "min_reward_points" integer NOT NULL DEFAULT 500;
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "max_reward_points" integer NOT NULL DEFAULT 2000;
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "min_conversation_turns" integer NOT NULL DEFAULT 2;
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "max_reading_attempts_per_day" integer NOT NULL DEFAULT 3;
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "reading_auto_approve" boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "books" (
  "id" serial PRIMARY KEY,
  "parent_id" integer NOT NULL REFERENCES "parents"("id") ON DELETE CASCADE,
  "isbn" text NOT NULL,
  "title" text NOT NULL,
  "author" text,
  "publisher" text,
  "cover_url" text,
  "description" text,
  "metadata_source" text,
  "verified_by_parent" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_books_parent_isbn" ON "books"("parent_id", "isbn");
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "book_id" integer REFERENCES "books"("id") ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS "book_reading_units" (
  "id" serial PRIMARY KEY,
  "book_id" integer NOT NULL REFERENCES "books"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "unit_order" integer NOT NULL,
  "page_from" integer,
  "page_to" integer
);

CREATE TABLE IF NOT EXISTS "reading_attempts" (
  "id" serial PRIMARY KEY,
  "mission_id" integer NOT NULL REFERENCES "missions"("id") ON DELETE CASCADE,
  "child_id" integer NOT NULL REFERENCES "children"("id") ON DELETE CASCADE,
  "reading_unit_key" text NOT NULL,
  "source_label" text NOT NULL,
  "reading_summary" text,
  "status" text NOT NULL DEFAULT 'in_progress',
  "child_message_count" integer NOT NULL DEFAULT 0,
  "off_topic_count" integer NOT NULL DEFAULT 0,
  "reward_points" integer NOT NULL DEFAULT 0,
  "evaluation" jsonb,
  "evaluation_reason" text,
  "transaction_id" integer REFERENCES "transactions"("id") ON DELETE SET NULL,
  "started_at" timestamptz NOT NULL DEFAULT now(),
  "completed_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "idx_reading_attempts_child_status" ON "reading_attempts"("child_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_reading_attempt_completed_unit" ON "reading_attempts"("mission_id", "child_id", "reading_unit_key") WHERE "status" = 'completed';

CREATE TABLE IF NOT EXISTS "reading_messages" (
  "id" serial PRIMARY KEY,
  "attempt_id" integer NOT NULL REFERENCES "reading_attempts"("id") ON DELETE CASCADE,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "safety_category" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
