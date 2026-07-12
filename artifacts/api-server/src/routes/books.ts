import { Router } from "express";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import { bookReadingUnitsTable, booksTable, childrenTable, db, missionsTable } from "@workspace/db";
import { readingFeatureFlags } from "../lib/featureFlags";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();
const isbnPattern = /^(?:\d{9}[\dX]|\d{13})$/;
const normalizeIsbn = (value: string) => value.replace(/[-\s]/g, "").toUpperCase();
function requireParent(req: any, res: any, next: any) {
  if (!req.session?.parentId) { res.status(401).json({ error: "부모 로그인이 필요해요." }); return; }
  next();
}

type BookLookupResult = {
  isbn: string;
  title: string;
  author: string | null;
  publisher: string | null;
  coverUrl: string | null;
  description: string | null;
  metadataSource: "google_books" | "open_library";
  units: string[];
};

async function lookupGoogleBooks(isbn: string, apiKey: string): Promise<BookLookupResult | null> {
  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", `isbn:${isbn}`);
  url.searchParams.set("maxResults", "1");
  url.searchParams.set("projection", "lite");
  url.searchParams.set("key", apiKey);

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`Google Books temporary failure: ${response.status}`);
      } else if (!response.ok) {
        throw new Error(`Google Books lookup failed: ${response.status}`);
      } else {
        const info = ((await response.json()) as any).items?.[0]?.volumeInfo;
        if (!info) return null;
        return {
          isbn,
          title: info.title,
          author: info.authors?.join(", ") ?? null,
          publisher: info.publisher ?? null,
          coverUrl: info.imageLinks?.thumbnail?.replace("http://", "https://") ?? null,
          description: info.description ?? null,
          metadataSource: "google_books",
          units: [],
        };
      }
    } catch (error) {
      lastError = error;
    }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
  throw lastError ?? new Error("Google Books lookup failed");
}

async function lookupOpenLibrary(isbn: string): Promise<BookLookupResult | null> {
  const key = `ISBN:${isbn}`;
  const url = new URL("https://openlibrary.org/api/books");
  url.searchParams.set("bibkeys", key);
  url.searchParams.set("format", "json");
  url.searchParams.set("jscmd", "data");
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Open Library lookup failed: ${response.status}`);
  const info = ((await response.json()) as Record<string, any>)[key];
  if (!info) return null;
  let units: string[] = [];
  if (typeof info.key === "string" && /^\/books\/OL\d+M$/.test(info.key)) {
    try {
      const editionResponse = await fetch(`https://openlibrary.org${info.key}.json`, { signal: AbortSignal.timeout(10_000) });
      if (editionResponse.ok) {
        const edition = (await editionResponse.json()) as any;
        units = (edition.table_of_contents ?? [])
          .map((item: any) => typeof item === "string" ? item : item?.title ?? item?.label)
          .filter((title: unknown): title is string => typeof title === "string" && title.trim().length > 0)
          .map((title: string) => title.trim())
          .slice(0, 100);
      }
    } catch { /* TOC is optional */ }
  }
  return {
    isbn,
    title: info.title,
    author: info.authors?.map((author: any) => author.name).filter(Boolean).join(", ") || null,
    publisher: info.publishers?.map((publisher: any) => publisher.name).filter(Boolean).join(", ") || null,
    coverUrl: info.cover?.medium ?? info.cover?.small ?? null,
    description: info.notes ?? null,
    metadataSource: "open_library",
    units,
  };
}

router.get("/books/lookup", requireParent, async (req, res) => {
  const isbn = normalizeIsbn(String(req.query.isbn ?? ""));
  if (!isbnPattern.test(isbn)) { res.status(400).json({ error: "ISBN 10자리 또는 13자리를 확인해 주세요." }); return; }
  const apiKey = process.env["GOOGLE_BOOKS_API_KEY"]?.trim();
  if (!apiKey) { res.status(503).json({ error: "Google Books API 설정이 필요해요." }); return; }

  try {
    let book: BookLookupResult | null = null;
    try { book = await lookupGoogleBooks(isbn, apiKey); } catch { /* fall through to Open Library */ }
    let openLibraryBook: BookLookupResult | null = null;
    try { openLibraryBook = await lookupOpenLibrary(isbn); } catch { /* metadata fallback remains optional */ }
    if (!book) book = openLibraryBook;
    else if (openLibraryBook?.units.length) book.units = openLibraryBook.units;
    if (!book) { res.status(404).json({ error: "ISBN에 해당하는 책을 찾지 못했어요. 직접 입력해 주세요." }); return; }
    res.json(book);
  } catch {
    res.status(502).json({ error: "도서 정보를 조회하지 못했어요." });
  }
});

const ExtractTocBody = z.object({
  imageDataUrl: z.string().max(8_000_000).regex(/^data:image\/(?:jpeg|jpg|png|webp);base64,/i),
});

router.post("/books/extract-toc", requireParent, async (req, res) => {
  const parsed = ExtractTocBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "10MB 이하의 JPG, PNG 또는 WebP 목차 사진을 선택해 주세요." }); return; }
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 3000,
      messages: [{ role: "user", content: [
        { type: "text", text: "이 사진은 책의 목차 페이지입니다. 장/절/부 제목을 읽는 순서대로 추출하세요. 페이지 번호와 점선은 제거하세요. 반드시 {\"units\":[\"제목1\",\"제목2\"]} JSON만 반환하세요. 보이지 않는 제목은 추측하지 마세요." },
        { type: "image_url", image_url: { url: parsed.data.imageDataUrl, detail: "high" } },
      ] }],
    });
    const content = completion.choices[0]?.message?.content ?? "";
    const json = content.match(/\{[\s\S]*\}/)?.[0];
    if (!json) throw new Error("No JSON returned");
    const result = z.object({ units: z.array(z.string().trim().min(1).max(200)).min(1).max(100) }).parse(JSON.parse(json));
    res.json(result);
  } catch (error) {
    req.log.error({ err: error }, "TOC image extraction failed");
    res.status(502).json({ error: "목차를 읽지 못했어요. 사진을 선명하게 다시 찍어 주세요." });
  }
});

const SaveBookBody = z.object({
  isbn: z.string().transform(normalizeIsbn).refine((value) => isbnPattern.test(value)),
  title: z.string().trim().min(1).max(200), author: z.string().trim().max(200).nullable().optional(),
  publisher: z.string().trim().max(200).nullable().optional(), coverUrl: z.string().url().nullable().optional(),
  description: z.string().trim().max(3000).nullable().optional(), metadataSource: z.string().max(50).nullable().optional(),
  units: z.array(z.object({ title: z.string().trim().min(1).max(200), pageFrom: z.number().int().positive().nullable().optional(), pageTo: z.number().int().positive().nullable().optional() })).min(1).max(100),
});

router.post("/books", requireParent, async (req, res) => {
  if (!readingFeatureFlags.bookMissionsEnabled) { res.status(404).json({ error: "일반도서 미션은 아직 준비 중이에요." }); return; }
  const parsed = SaveBookBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "책 정보와 목차를 확인해 주세요." }); return; }
  const parentId = req.session.parentId!;
  const [existing] = await db.select({ id: booksTable.id }).from(booksTable).where(and(eq(booksTable.parentId, parentId), eq(booksTable.isbn, parsed.data.isbn))).limit(1);
  if (existing) { res.status(409).json({ error: "이미 등록한 ISBN이에요." }); return; }
  const book = await db.transaction(async (tx) => {
    const { units, ...metadata } = parsed.data;
    const [created] = await tx.insert(booksTable).values({ parentId, ...metadata, verifiedByParent: true }).returning();
    await tx.insert(bookReadingUnitsTable).values(units.map((unit, index) => ({ bookId: created.id, title: unit.title, unitOrder: index + 1, pageFrom: unit.pageFrom, pageTo: unit.pageTo })));
    return created;
  });
  res.status(201).json(book);
});

router.get("/books", async (req, res) => {
  let parentId = req.session?.parentId as number | undefined;
  if (!parentId && req.session?.childId) {
    const [child] = await db.select({ parentId: childrenTable.parentId }).from(childrenTable).where(eq(childrenTable.id, req.session.childId)).limit(1);
    parentId = child?.parentId;
  }
  if (!parentId) { res.status(401).json({ error: "로그인이 필요해요." }); return; }
  let books = await db.select().from(booksTable).where(eq(booksTable.parentId, parentId));
  if (req.session?.childId) {
    const links = await db.select({ bookId: missionsTable.bookId }).from(missionsTable).where(and(eq(missionsTable.parentId, parentId), eq(missionsTable.type, "book"), eq(missionsTable.isActive, true)));
    const allowed = links.flatMap((row) => row.bookId == null ? [] : [row.bookId]);
    books = books.filter((book) => allowed.includes(book.id));
  }
  const ids = books.map((book) => book.id);
  const units = ids.length ? await db.select().from(bookReadingUnitsTable).where(inArray(bookReadingUnitsTable.bookId, ids)).orderBy(asc(bookReadingUnitsTable.unitOrder)) : [];
  res.json(books.map((book) => ({ ...book, units: units.filter((unit) => unit.bookId === book.id) })));
});

export default router;
