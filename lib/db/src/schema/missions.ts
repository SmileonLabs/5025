import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { parentsTable } from "./parents";

export const missionsTable = pgTable("missions", {
  id: serial("id").primaryKey(),
  parentId: integer("parent_id").notNull().references(() => parentsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  type: text("type").notNull().$type<"bible" | "auto" | "confirm">(),
  reward: integer("reward").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DbMission = typeof missionsTable.$inferSelect;
