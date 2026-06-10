import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { parentsTable } from "./parents";

export const topupsTable = pgTable("topups", {
  id: serial("id").primaryKey(),
  parentId: integer("parent_id")
    .notNull()
    .references(() => parentsTable.id, { onDelete: "cascade" }),
  stripeSessionId: text("stripe_session_id").notNull().unique(),
  amount: integer("amount").notNull(),
  status: text("status").notNull().$type<"pending" | "paid">().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Topup = typeof topupsTable.$inferSelect;
