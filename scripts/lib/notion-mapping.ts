/**
 * Pure mapping from a Notion "My library" page to rows for `books` and `readings`.
 * No network calls here, so it can be unit-tested (see notion-mapping.test.ts).
 */
import type { PageObjectResponse } from "@notionhq/client";
import type { Database } from "../../lib/database.types";

type BookInsert = Database["public"]["Tables"]["books"]["Insert"];
type ReadingInsert = Database["public"]["Tables"]["readings"]["Insert"];
type BookStatus = Database["public"]["Enums"]["book_status"];
type PropertyValue = PageObjectResponse["properties"][string];

export interface MappedPage {
  book: BookInsert & { notion_page_id: string };
  /** The reading to create when the book has none yet (without book_id/user_id). */
  reading: Omit<ReadingInsert, "book_id" | "user_id"> | null;
  cover: { url: string; source: "notion" | "external" } | null;
  warnings: string[];
}

export type MapResult = { ok: true; value: MappedPage } | { ok: false; reason: string };

const READING_STATUS: Record<string, BookStatus> = {
  "Not started": "to-read",
  Reading: "reading",
  Paused: "paused",
  Finished: "finished",
};

/** Fixes for spelling in Notion select options. */
const GENRE_RENAMES: Record<string, string> = {
  "Triller/Detective": "Thriller/Detective",
};

function text(value: PropertyValue | undefined): string {
  if (!value) return "";
  if (value.type === "title") return value.title.map((t) => t.plain_text).join("").trim();
  if (value.type === "rich_text") return value.rich_text.map((t) => t.plain_text).join("").trim();
  return "";
}

function selectName(value: PropertyValue | undefined): string | null {
  if (value?.type === "select") return value.select?.name ?? null;
  if (value?.type === "status") return value.status?.name ?? null;
  return null;
}

function num(value: PropertyValue | undefined): number | null {
  return value?.type === "number" ? value.number : null;
}

/** Notion dates may include a time; we store plain dates. */
function date(value: PropertyValue | undefined): string | null {
  return value?.type === "date" && value.date ? value.date.start.slice(0, 10) : null;
}

export function splitAuthors(raw: string): string[] {
  return raw
    .split(/[,;]/)
    .map((a) => a.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function mapNotionPage(page: PageObjectResponse): MapResult {
  const p = page.properties;
  const warnings: string[] = [];

  const title = text(p["Title"]).replace(/\s+/g, " ");
  if (!title) return { ok: false, reason: "no title" };

  const authors = splitAuthors(text(p["Author"]));
  if (authors.length === 0) warnings.push("no author");

  const readingStatus = selectName(p["Reading status"]);
  let status: BookStatus = "to-read";
  if (readingStatus && READING_STATUS[readingStatus]) {
    status = READING_STATUS[readingStatus];
  } else {
    warnings.push(
      readingStatus ? `unknown reading status "${readingStatus}" → to-read` : "no reading status → to-read",
    );
  }

  const ownership = selectName(p["Status"]);
  const soldAt = date(p["Date Sold"]);
  // Rows with no Owned/Sold value are recent additions that are owned (confirmed by the user).
  const owned = ownership !== "Sold";
  if (ownership !== "Owned" && ownership !== "Sold") warnings.push("no Owned/Sold status → owned");

  const genre = selectName(p["Genre"]);
  const genres = genre ? [GENRE_RENAMES[genre] ?? genre] : [];

  const year = num(p["Publishing Year"]);
  const publishedYear = year !== null && Number.isInteger(year) && year >= 0 && year <= 2100 ? year : null;
  if (year !== null && publishedYear === null) warnings.push(`invalid year ${year}`);

  const price = (v: number | null) => (v !== null && v >= 0 ? v : null);

  // "Feeling" only ever holds ❤️; anything else is kept in the notes.
  const feeling = text(p["Feeling"]);
  const favorite = feeling.includes("❤");
  const otherFeeling = feeling.replace(/❤️?/g, "").trim();
  const noteParts = [text(p["Notes"]), otherFeeling ? `Feeling: ${otherFeeling}` : ""].filter(Boolean);

  const acquiredAt = date(p["Date Added"]);

  const book: MappedPage["book"] = {
    notion_page_id: page.id,
    title,
    authors,
    status,
    favorite,
    genres,
    publisher: text(p["Publishing House"]) || selectName(p["Publishing House"]) || null,
    published_year: publishedYear,
    language: "uk",
    format: "paper",
    owned,
    acquired_at: acquiredAt,
    purchase_price: price(num(p["Purchase Price (UAH)"])),
    sold_at: soldAt,
    sale_price: price(num(p["Sale Price (UAH)"])),
    currency: "UAH",
    notes: noteParts.join("\n\n") || null,
    // Notion's created_time is when the Notion row was made (mid-2026), so prefer Date Added.
    created_at: acquiredAt ? `${acquiredAt}T12:00:00Z` : page.created_time,
  };

  let reading: MappedPage["reading"] = null;
  if (status === "finished") reading = { outcome: "finished", started_at: null, finished_at: null };
  else if (status === "reading" || status === "paused") reading = { outcome: null, started_at: null, finished_at: null };

  let cover: MappedPage["cover"] = null;
  const files = p["Cover"]?.type === "files" ? p["Cover"].files : [];
  const first = files[0];
  if (first) cover = first.type === "file" ? { url: first.file.url, source: "notion" } : { url: first.external.url, source: "external" };
  else if (page.cover) {
    cover = page.cover.type === "file" ? { url: page.cover.file.url, source: "notion" } : { url: page.cover.external.url, source: "external" };
  }

  return { ok: true, value: { book, reading, cover, warnings } };
}

/** Lower-cased "title|authors" key used to spot possible duplicates. */
export function duplicateKey(book: Pick<BookInsert, "title" | "authors">): string {
  return `${book.title.toLowerCase()}|${(book.authors ?? []).join(", ").toLowerCase()}`;
}
