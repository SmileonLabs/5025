-- Keep every attempt as an audit trail. Retrying must never erase a child's
-- completed work or the original reward transaction.
ALTER TABLE "reading_attempts" ADD COLUMN IF NOT EXISTS "reset_at" timestamptz;
ALTER TABLE "reading_attempts" ADD COLUMN IF NOT EXISTS "reset_reason" text;

ALTER TABLE "great_question_sessions" ADD COLUMN IF NOT EXISTS "reset_at" timestamptz;
ALTER TABLE "great_question_sessions" ADD COLUMN IF NOT EXISTS "reset_reason" text;

-- A reset session is retained for history, but does not block a new daily try.
DROP INDEX IF EXISTS "uq_great_question_child_date";
CREATE UNIQUE INDEX IF NOT EXISTS "uq_great_question_active_child_date"
  ON "great_question_sessions"("child_id", "session_date")
  WHERE "status" <> 'reset';
