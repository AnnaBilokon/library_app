import { z } from "zod";
import { languageLabel } from "@/lib/books/labels";
import type { Edition } from "@/lib/catalog/editions";
import { poolBooks } from "@/lib/surprise";
import type { Book } from "@/lib/types";

/** How many books Claude may pick from your shelves, and from the catalog. */
export const SHELF_PICKS = 4;
export const CATALOG_PICKS = 4;
/** How many catalog editions go into the prompt at most. */
export const CATALOG_CANDIDATES = 60;

const pick = z.object({ ref: z.string(), reason: z.string() });

/** What Claude sends back. Refs point into the numbered lists: b1, b2… (shelves), c1, c2… (catalog). */
export const similarAnswerSchema = z.object({
  fromShelves: z.array(pick),
  fromCatalog: z.array(pick),
});
export type SimilarAnswer = z.infer<typeof similarAnswerSchema>;

export interface SimilarPick {
  book: Book;
  reason: string;
}

export interface CatalogPick {
  edition: Edition;
  reason: string;
}

export interface SimilarBooks {
  fromShelves: SimilarPick[];
  fromCatalog: CatalogPick[];
}

export const SIMILAR_SYSTEM = `You recommend books to one reader, from their own shelves and from a shared catalog.

You get the book they're looking at, a numbered list of unread books they already own, a numbered list of catalog books they don't have yet, and books they loved or gave up on.

1. From the unread list (refs b1, b2, …), pick up to ${SHELF_PICKS} books someone who reads this one would enjoy next.
2. From the catalog list (refs c1, c2, …), pick up to ${CATALOG_PICKS} books worth getting.

Look for a shared feel, themes, style or subject, not just the same genre; books sharing an author, series or genre come first in each list. Return fewer, or none, when nothing on a list is close.

For every pick, write one short sentence (under 25 words, in the language named at the end of the message) saying why, tied to this book: what they share, not a summary of the plot.`;

const clip = (text: string | undefined, max: number) => {
  const t = text?.replace(/\s+/g, " ").trim();
  return t && t.length > max ? `${t.slice(0, max - 1)}…` : t;
};
const byline = (b: Pick<Book, "title" | "authors">) => (b.authors.length ? `${b.title} — ${b.authors.join(", ")}` : b.title);

/** How close a book or edition is to this one: shared authors and series count most, then genres. */
function closeness(book: Book, other: Pick<Book, "authors" | "genres" | "series">): number {
  return (
    other.genres.filter((g) => book.genres.includes(g)).length +
    2 * other.authors.filter((a) => book.authors.includes(a)).length +
    (book.series && other.series === book.series ? 2 : 0)
  );
}

/**
 * Unread books on your shelves, other than this one: where shelf picks come from. Those sharing
 * genres, authors or a series with it come first, so the likeliest picks aren't lost in a long list.
 */
export function shelfCandidates(book: Book, all: Book[]): Book[] {
  return poolBooks(all, "unread")
    .filter((b) => b.id !== book.id)
    .map((b) => ({ b, score: closeness(book, b) }))
    .sort((x, y) => y.score - x.score)
    .map(({ b }) => b);
}

export type CatalogRow = Pick<Edition, "id" | "title" | "authors" | "genres" | "series" | "createdAt">;

/**
 * The catalog shortlist: editions you don't have a book for, closest first (author, series,
 * genres), then the newest, at most `limit`. Only these go into the prompt.
 */
export function catalogShortlist(book: Book, rows: CatalogRow[], myEditionIds: Set<string>, limit = CATALOG_CANDIDATES): string[] {
  return rows
    .filter((e) => !myEditionIds.has(e.id))
    .map((e) => ({ id: e.id, score: closeness(book, e), createdAt: e.createdAt }))
    .sort((a, b) => b.score - a.score || b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map((e) => e.id);
}

/** The user message: this book, the unread shelf, the catalog shortlist, and what the reader loved and dropped. */
export function similarPrompt(book: Book, candidates: Book[], all: Book[], catalog: Edition[] = []): string {
  const about = [
    `Title: ${book.title}`,
    book.authors.length && `Authors: ${book.authors.join(", ")}`,
    book.publishedYear && `Published: ${book.publishedYear}`,
    book.series && `Series: ${book.series}`,
    book.genres.length && `Genres: ${book.genres.join(", ")}`,
    book.tags.length && `Tags: ${book.tags.join(", ")}`,
    book.rating && `Reader's rating: ${book.rating}/5`,
    book.description && `About: ${clip(book.description, 1500)}`,
    book.review && `Reader's review: ${clip(book.review, 1500)}`,
  ].filter(Boolean);

  const unread = candidates.map((b, i) =>
    [`b${i + 1}`, byline(b), b.genres.join(", "), clip(b.description, 200)].filter(Boolean).join(" | "),
  );
  const inCatalog = catalog.map((e, i) =>
    [`c${i + 1}`, byline(e), e.series, e.genres.join(", "), clip(e.description, 200)].filter(Boolean).join(" | "),
  );
  const loved = all
    .filter((b) => b.id !== book.id && (b.favorite || (b.rating ?? 0) >= 4.5))
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 25)
    .map((b) => `${byline(b)}${b.rating ? ` (${b.rating}/5)` : ""}`);
  const dropped = all
    .filter((b) => b.status === "abandoned")
    .slice(0, 15)
    .map((b) => {
      const reason = b.readings.findLast((r) => r.outcome === "abandoned")?.stopReason;
      return reason ? `${byline(b)}: "${clip(reason, 150)}"` : byline(b);
    });

  const section = (title: string, lines: string[]) => `<${title}>\n${lines.length ? lines.join("\n") : "(none)"}\n</${title}>`;
  return [
    section("this_book", about as string[]),
    section("unread_on_shelves", unread),
    section("in_catalog_not_owned", inCatalog),
    section("loved", loved),
    section("did_not_finish", dropped),
    // The reader reads this book in its language, so the reasons are in it too.
    `Write the reasons in ${book.language ? languageLabel(book.language) : "English"}.`,
  ].join("\n\n");
}

/** Picks back to things: refs with the right letter that exist, each once, at most `max`. */
function resolve<T extends { id: string }>(picks: SimilarAnswer["fromShelves"], letter: "b" | "c", list: T[], max: number) {
  const seen = new Set<string>();
  const out: { item: T; reason: string }[] = [];
  for (const { ref, reason } of picks) {
    const item = list[Number(new RegExp(`^${letter}(\\d+)$`).exec(ref.trim())?.[1]) - 1];
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push({ item, reason: reason.trim() });
  }
  return out.slice(0, max);
}

/** Turns Claude's answer into books and editions: unknown, repeated or wrong-list refs are dropped. */
export function resolveAnswer(answer: SimilarAnswer, candidates: Book[], catalog: Edition[] = []): SimilarBooks {
  return {
    fromShelves: resolve(answer.fromShelves, "b", candidates, SHELF_PICKS).map(({ item, reason }) => ({ book: item, reason })),
    fromCatalog: resolve(answer.fromCatalog, "c", catalog, CATALOG_PICKS).map(({ item, reason }) => ({ edition: item, reason })),
  };
}
