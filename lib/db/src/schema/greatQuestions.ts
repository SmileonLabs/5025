import { sql } from "drizzle-orm";
import { date, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { childrenTable } from "./children";
import { transactionsTable } from "./transactions";

export type GreatQuestionEvaluation = {
  relevant: boolean;
  curiosityScore: number;
  depthScore: number;
  originalityScore: number;
  clarityScore: number;
  reason: string;
  greatQuestion?: string;
  questionTitle?: string;
};

export const greatQuestionProfilesTable = pgTable("great_question_profiles", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull().references(() => childrenTable.id, { onDelete: "cascade" }),
  domainKey: text("domain_key").notNull(),
  domainLabel: text("domain_label").notNull(),
  selectedAt: timestamp("selected_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("uq_great_question_profile_child").on(table.childId)]);

export const greatQuestionSessionsTable = pgTable("great_question_sessions", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull().references(() => childrenTable.id, { onDelete: "cascade" }),
  sessionDate: date("session_date").notNull(),
  domainKey: text("domain_key").notNull(),
  domainLabel: text("domain_label").notNull(),
  scenario: text("scenario").notNull(),
  status: text("status").notNull().$type<"in_progress" | "completed" | "reset">().default("in_progress"),
  childMessageCount: integer("child_message_count").notNull().default(0),
  rewardPoints: integer("reward_points").notNull().default(0),
  evaluation: jsonb("evaluation").$type<GreatQuestionEvaluation>(),
  finalQuestion: text("final_question"),
  questionTitle: text("question_title"),
  transactionId: integer("transaction_id").references(() => transactionsTable.id, { onDelete: "set null" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  resetAt: timestamp("reset_at", { withTimezone: true }),
  resetReason: text("reset_reason"),
}, (table) => [
  uniqueIndex("uq_great_question_active_child_date").on(table.childId, table.sessionDate).where(sql`${table.status} <> 'reset'`),
  index("idx_great_question_child_status").on(table.childId, table.status),
]);

export const greatQuestionMessagesTable = pgTable("great_question_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => greatQuestionSessionsTable.id, { onDelete: "cascade" }),
  role: text("role").notNull().$type<"child" | "assistant">(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
