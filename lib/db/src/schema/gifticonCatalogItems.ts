import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
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
  price: integer("price").notNull(), // 고정가 상품의 차감 포인트. 자유금액(금액권) 상품이면 0.
  isVariablePrice: boolean("is_variable_price").notNull().default(false), // true면 아이가 주문 시 금액 직접 입력(잔액까지)
  emoji: text("emoji").notNull().default("🎁"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GifticonCatalogItem = typeof gifticonCatalogItemsTable.$inferSelect;
