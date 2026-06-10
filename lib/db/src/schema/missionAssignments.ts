import { pgTable, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { missionsTable } from "./missions";
import { childrenTable } from "./children";

// assignToAll=false 미션의 대상 아이 목록. 행 존재 ⟺ 해당 아이가 대상.
export const missionAssignmentsTable = pgTable(
  "mission_assignments",
  {
    id: serial("id").primaryKey(),
    missionId: integer("mission_id").notNull().references(() => missionsTable.id, { onDelete: "cascade" }),
    childId: integer("child_id").notNull().references(() => childrenTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqMissionChild: unique().on(t.missionId, t.childId),
  }),
);

export type DbMissionAssignment = typeof missionAssignmentsTable.$inferSelect;
