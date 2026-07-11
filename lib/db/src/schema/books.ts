import { boolean, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { parentsTable } from "./parents";

export const booksTable = pgTable("books", {
  id: serial("id").primaryKey(),
  parentId: integer("parent_id").notNull().references(() => parentsTable.id, { onDelete: "cascade" }),
  isbn: text("isbn").notNull(),
  title: text("title").notNull(),
  author: text("author"),
  publisher: text("publisher"),
  coverUrl: text("cover_url"),
  description: text("description"),
  metadataSource: text("metadata_source"),
  verifiedByParent: boolean("verified_by_parent").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("uq_books_parent_isbn").on(table.parentId, table.isbn)]);

export const bookReadingUnitsTable = pgTable("book_reading_units", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id").notNull().references(() => booksTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  unitOrder: integer("unit_order").notNull(),
  pageFrom: integer("page_from"),
  pageTo: integer("page_to"),
});

export type Book = typeof booksTable.$inferSelect;
export type BookReadingUnit = typeof bookReadingUnitsTable.$inferSelect;
