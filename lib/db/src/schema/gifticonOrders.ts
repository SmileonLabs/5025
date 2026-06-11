import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { parentsTable } from "./parents";
import { childrenTable } from "./children";
import { transactionsTable } from "./transactions";

export const gifticonOrdersTable = pgTable("gifticon_orders", {
  id: serial("id").primaryKey(),
  childId: integer("child_id")
    .notNull()
    .references(() => childrenTable.id, { onDelete: "cascade" }),
  parentId: integer("parent_id")
    .notNull()
    .references(() => parentsTable.id, { onDelete: "cascade" }),
  // Catalog reference + snapshot (catalog prices/names can change later).
  catalogItemId: text("catalog_item_id").notNull(),
  brand: text("brand").notNull(),
  productName: text("product_name").notNull(),
  faceValue: integer("face_value").notNull(),
  price: integer("price").notNull(), // amount deducted from the child's balance
  emoji: text("emoji").notNull().default("🎁"),
  status: text("status")
    .notNull()
    .$type<"requested" | "fulfilled" | "rejected" | "canceled" | "used">()
    .default("requested"),
  // Ledger links (set on the spend/refund rows created server-side).
  transactionId: integer("transaction_id").references(() => transactionsTable.id, {
    onDelete: "set null",
  }),
  refundTransactionId: integer("refund_transaction_id").references(() => transactionsTable.id, {
    onDelete: "set null",
  }),
  rejectReason: text("reject_reason"),
  // Operator-issued gifticon details (manual fulfillment).
  issuedPin: text("issued_pin"),
  issuedBarcode: text("issued_barcode"),
  issuedImageUrl: text("issued_image_url"),
  fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
  // Set when the owning child marks the issued gifticon as used (terminal).
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GifticonOrder = typeof gifticonOrdersTable.$inferSelect;
