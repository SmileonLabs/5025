import { pgTable, serial, text, integer, boolean, timestamp, date } from "drizzle-orm/pg-core";
import { parentsTable } from "./parents";
import { booksTable } from "./books";

export const missionsTable = pgTable("missions", {
  id: serial("id").primaryKey(),
  parentId: integer("parent_id").notNull().references(() => parentsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  // "bible" = 성경읽기(AI 퀴즈 통과 시 즉시 지급), "activity" = 부모 확인형 활동 미션
  type: text("type").notNull().$type<"bible" | "activity" | "book">(),
  reward: integer("reward").notNull().default(0),
  minRewardPoints: integer("min_reward_points").notNull().default(500),
  maxRewardPoints: integer("max_reward_points").notNull().default(2000),
  minConversationTurns: integer("min_conversation_turns").notNull().default(2),
  maxReadingAttemptsPerDay: integer("max_reading_attempts_per_day").notNull().default(3),
  readingAutoApprove: boolean("reading_auto_approve").notNull().default(true),
  bookId: integer("book_id").references(() => booksTable.id, { onDelete: "set null" }),
  // activity 전용 설정 (bible 미션은 무시)
  scheduleType: text("schedule_type").notNull().$type<"daily" | "once">().default("daily"),
  scheduledDate: date("scheduled_date"), // scheduleType === "once" 일 때 지정일 (YYYY-MM-DD)
  timeLimit: text("time_limit"), // "HH:MM" 마감 시각(KST). null이면 제한 없음
  requiresPhoto: boolean("requires_photo").notNull().default(false), // 인증샷 필요 여부
  // activity 전용: 한 아이가 이 미션을 수행할 수 있는 최대 횟수(승인+대기 누적, 반려 제외). null이면 무제한.
  maxCompletions: integer("max_completions"),
  // true(기본)면 부모의 모든 아이가 대상(동적). false면 mission_assignments에 명시된 아이만 대상.
  // 불변식: assignToAll=true이면 assignments 행이 없어야 한다.
  assignToAll: boolean("assign_to_all").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DbMission = typeof missionsTable.$inferSelect;
