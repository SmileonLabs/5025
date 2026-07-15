import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function main(): Promise<void> {
  logger.info("Using Toss Payments top-up flow");

  // Replit's production database is separate from the development database.
  // Keep old deployments readable when the notebook columns have not yet
  // reached that production database through the normal post-merge migration.
  await pool.query(`
    ALTER TABLE great_question_sessions
      ADD COLUMN IF NOT EXISTS final_question text;
    ALTER TABLE great_question_sessions
      ADD COLUMN IF NOT EXISTS question_title text;
  `);

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}

void main();
