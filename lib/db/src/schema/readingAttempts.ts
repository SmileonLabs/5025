import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { childrenTable } from "./children";
import { missionsTable } from "./missions";
import { transactionsTable } from "./transactions";

export type ReadingEvaluation = {
  relevant: boolean;
  relevanceScore: number;
  specificityScore: number;
  reasoningScore: number;
  selfExpressionScore: number;
  followUpScore: number;
  reason: string;
};

export const readingAttemptsTable = pgTable("reading_attempts", {
  id: serial("id").primaryKey(),
  missionId: integer("mission_id").notNull().references(() => missionsTable.id, { onDelete: "cascade" }),
  childId: integer("child_id").notNull().references(() => childrenTable.id, { onDelete: "cascade" }),
  readingUnitKey: text("reading_unit_key").notNull(),
  status: text("status").notNull().$type<"in_progress" | "failed" | "completed" | "abandoned">().default("in_progress"),
  childMessageCount: integer("child_message_count").notNull().default(0),
  offTopicCount: integer("off_topic_count").notNull().default(0),
  rewardPoints: integer("reward_points").notNull().default(0),
  evaluation: jsonb("evaluation").$type<ReadingEvaluation>(),
  evaluationReason: text("evaluation_reason"),
  transactionId: integer("transaction_id").references(() => transactionsTable.id, { onDelete: "set null" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [
  index("idx_reading_attempts_child_status").on(table.childId, table.status),
  uniqueIndex("uq_reading_attempt_completed_unit")
    .on(table.missionId, table.childId, table.readingUnitKey)
    .where(sql`${table.status} = 'completed'`),
]);

export const readingMessagesTable = pgTable("reading_messages", {
  id: serial("id").primaryKey(),
  attemptId: integer("attempt_id").notNull().references(() => readingAttemptsTable.id, { onDelete: "cascade" }),
  role: text("role").notNull().$type<"child" | "assistant" | "system">(),
  content: text("content").notNull(),
  safetyCategory: text("safety_category"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ReadingAttempt = typeof readingAttemptsTable.$inferSelect;
export type ReadingMessage = typeof readingMessagesTable.$inferSelect;
