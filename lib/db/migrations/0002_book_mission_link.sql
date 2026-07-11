ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "book_id" integer REFERENCES "books"("id") ON DELETE SET NULL;
