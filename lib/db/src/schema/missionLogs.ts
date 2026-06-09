import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { missionsTable } from "./missions";
import { childrenTable } from "./children";

export const missionLogsTable = pgTable("mission_logs", {
  id: serial("id").primaryKey(),
  missionId: integer("mission_id").notNull().references(() => missionsTable.id, { onDelete: "cascade" }),
  childId: integer("child_id").notNull().references(() => childrenTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().$type<"completed" | "requested" | "approved" | "rejected">(),
  bibleBook: text("bible_book"),
  bibleChapter: integer("bible_chapter"),
  transactionId: integer("transaction_id"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DbMissionLog = typeof missionLogsTable.$inferSelect;
