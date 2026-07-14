ALTER TABLE "great_question_sessions" ADD COLUMN IF NOT EXISTS "final_question" text;
ALTER TABLE "great_question_sessions" ADD COLUMN IF NOT EXISTS "question_title" text;

