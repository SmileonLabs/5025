import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { parentsTable } from "./parents";

/**
 * Per-parent gifticon shop catalog. Each parent registers/deletes their own
 * items; a child only ever sees the catalog belonging to their parent. The
 * price is in points (the app-wide currency) and is authoritative on the server
 * — order creation looks it up here, clients never send a price. Hard delete is
 * safe because orders snapshot brand/name/price at purchase time.
 */
export const gifticonCatalogItemsTable = pgTable("gifticon_catalog_items", {
  id: serial("id").primaryKey(),
  parentId: integer("parent_id")
    .notNull()
    .references(() => parentsTable.id, { onDelete: "cascade" }),
  brand: text("brand").notNull(),
  productName: text("product_name").notNull(),
  price: integer("price").notNull(), // points deducted from the child's balance
  emoji: text("emoji").notNull().default("🎁"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GifticonCatalogItem = typeof gifticonCatalogItemsTable.$inferSelect;
