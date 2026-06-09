import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { parentsTable } from "./parents";

export const childrenTable = pgTable("children", {
  id: serial("id").primaryKey(),
  parentId: integer("parent_id").notNull().references(() => parentsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  age: integer("age").notNull(),
  avatar: text("avatar").notNull().default("🌟"),
  pinHash: text("pin_hash").notNull(),
  balance: integer("balance").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertChildSchema = createInsertSchema(childrenTable).omit({ id: true, createdAt: true });
export type InsertChild = z.infer<typeof insertChildSchema>;
export type Child = typeof childrenTable.$inferSelect;
