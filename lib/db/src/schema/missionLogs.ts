import { pgTable, serial, text, integer, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { missionsTable } from "./missions";
import { childrenTable } from "./children";

// bible 미션 수행 시 풀었던 AI 퀴즈 스냅샷 (수행 내역 상세 표시용). 제출 시점에만 저장.
export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

export const missionLogsTable = pgTable(
  "mission_logs",
  {
    id: serial("id").primaryKey(),
    missionId: integer("mission_id").notNull().references(() => missionsTable.id, { onDelete: "cascade" }),
    childId: integer("child_id").notNull().references(() => childrenTable.id, { onDelete: "cascade" }),
    status: text("status").notNull().$type<"completed" | "requested" | "approved" | "rejected" | "reverted">(),
    bibleBook: text("bible_book"),
    bibleChapter: integer("bible_chapter"),
    reflection: text("reflection"),
    quiz: jsonb("quiz").$type<QuizQuestion[]>(), // bible 미션 퀴즈 문항 스냅샷(legacy 로그는 null)
    photoUrl: text("photo_url"), // activity 인증샷 objectPath ("/objects/...")
    transactionId: integer("transaction_id"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // 닫힌 용돈 구조에서 보상은 실돈 결제 포인트라 같은 장 동시 제출이 부모 잔액을 이중 차감하면 안 된다.
    // 부분 유니크 인덱스로 "완료된 같은 장" 중복을 DB 레벨에서 백스톱(라우트 사전 체크는 빠른 피드백용).
    uqBibleChapter: uniqueIndex("uq_mission_logs_bible_chapter")
      .on(t.missionId, t.childId, t.bibleBook, t.bibleChapter)
      .where(sql`${t.status} = 'completed'`),
  }),
);

export type DbMissionLog = typeof missionLogsTable.$inferSelect;
