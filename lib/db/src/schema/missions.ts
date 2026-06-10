import { pgTable, serial, text, integer, boolean, timestamp, date } from "drizzle-orm/pg-core";
import { parentsTable } from "./parents";

export const missionsTable = pgTable("missions", {
  id: serial("id").primaryKey(),
  parentId: integer("parent_id").notNull().references(() => parentsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  // "bible" = 성경읽기(AI 퀴즈 통과 시 즉시 지급), "activity" = 부모 확인형 활동 미션
  type: text("type").notNull().$type<"bible" | "activity">(),
  reward: integer("reward").notNull().default(0),
  // activity 전용 설정 (bible 미션은 무시)
  scheduleType: text("schedule_type").notNull().$type<"daily" | "once">().default("daily"),
  scheduledDate: date("scheduled_date"), // scheduleType === "once" 일 때 지정일 (YYYY-MM-DD)
  timeLimit: text("time_limit"), // "HH:MM" 마감 시각(KST). null이면 제한 없음
  requiresPhoto: boolean("requires_photo").notNull().default(false), // 인증샷 필요 여부
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DbMission = typeof missionsTable.$inferSelect;
