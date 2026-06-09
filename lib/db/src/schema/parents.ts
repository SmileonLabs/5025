import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const parentsTable = pgTable("parents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  balance: integer("balance").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertParentSchema = createInsertSchema(parentsTable).omit({ id: true, createdAt: true });
export type InsertParent = z.infer<typeof insertParentSchema>;
export type Parent = typeof parentsTable.$inferSelect;
