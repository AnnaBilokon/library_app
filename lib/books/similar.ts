import { z } from "zod";
import { poolBooks } from "@/lib/surprise";
import type { Book } from "@/lib/types";
import { normalize } from "./filters";

/** How many books Claude may suggest from your shelves, and how many new ones. */
export const SHELF_PICKS = 4;
export const NEW_PICKS = 4;

/** What Claude sends back. Shelf picks refer to the numbered list ("b1", "b2", …) in the prompt. */
export const similarAnswerSchema = z.object({
  fromShelves: z.array(z.object({ ref: z.string(), reason: z.string() })),
  newBooks: z.array(
    z.object({
      title: z.string(),
      authors: z.array(z.string()),
      year: z.number().int().nullable(),
      genres: z.array(z.string()),
      reason: z.string(),
    }),
  ),
});
export type SimilarAnswer = z.infer<typeof similarAnswerSchema>;

export interface NewSuggestion {
  title: string;
  authors: string[];
  year?: number;
  genres: string[];
  reason: string;
}

export interface SimilarBooks {
  fromShelves: { book: Book; reason: string }[];
  newBooks: NewSuggestion[];
}

export const SIMILAR_SYSTEM = `You recommend books to one reader, using what's in their personal library.

You get the book they're looking at, a numbered list of unread books they already own, books they loved or gave up on, and everything already in their library or on their wishlist.

1. This matters most: from the unread list, pick up to ${SHELF_PICKS} books someone who reads this one would enjoy next. The reader already owns them, so a good pick here is worth more than any new book. Look for a shared feel, themes, style or subject, not just the same genre; books sharing a genre or author come first in the list. Refer to them by their ref (b1, b2, …). Return fewer only when nothing on the list is close.
2. Suggest up to ${NEW_PICKS} real, published books the reader doesn't have yet: nothing from the "already in the library" list. Only suggest books you're sure exist, with the author's name as it's usually published. Use the title of the edition in the reader's language when you're sure of it, otherwise the original title. At most one by the same author as this book.

For every pick, write one short sentence (under 25 words, in English) saying why, tied to this book: what they share, not a summary of the plot. For new books, choose up to 3 genres from the reader's own genre list.`;

const clip = (text: string | undefined, max: number) => {
  const t = text?.replace(/\s+/g, " ").trim();
  return t && t.length > max ? `${t.slice(0, max - 1)}…` : t;
};
const byline = (b: Pick<Book, "title" | "authors">) => (b.authors.length ? `${b.title} — ${b.authors.join(", ")}` : b.title);

/**
 * Unread books on your shelves, other than this one: where shelf picks come from. Those sharing
 * genres, authors or a series with it come first, so the likeliest picks aren't lost in a long list.
 */
export function shelfCandidates(book: Book, all: Book[]): Book[] {
  const overlap = (b: Book) =>
    b.genres.filter((g) => book.genres.includes(g)).length +
    2 * b.authors.filter((a) => book.authors.includes(a)).length +
    (book.series && b.series === book.series ? 2 : 0);
  return poolBooks(all, "unread")
    .filter((b) => b.id !== book.id)
    .map((b) => ({ b, score: overlap(b) }))
    .sort((x, y) => y.score - x.score)
    .map(({ b }) => b);
}

/** The user message: this book, the unread shelf, what the reader loved and dropped, and what they already have. */
export function similarPrompt(book: Book, candidates: Book[], all: Book[]): string {
  const about = [
    `Title: ${book.title}`,
    book.authors.length && `Authors: ${book.authors.join(", ")}`,
    book.publishedYear && `Published: ${book.publishedYear}`,
    book.language && `Reader's edition language: ${book.language}`,
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
  const genres = [...new Set(all.flatMap((b) => b.genres))].sort();

  const section = (title: string, lines: string[]) => `<${title}>\n${lines.length ? lines.join("\n") : "(none)"}\n</${title}>`;
  return [
    section("this_book", about as string[]),
    section("unread_on_shelves", unread),
    section("loved", loved),
    section("did_not_finish", dropped),
    section("reader_genres", genres),
    section("already_in_library", all.map(byline)),
  ].join("\n\n");
}

const titleKey = (title: string) => normalize(title).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const surname = (author: string) => normalize(author).trim().split(/\s+/).at(-1) ?? "";

/** Is this suggestion a book the reader already has (same title, and an author in common)? */
function alreadyHave(s: Pick<NewSuggestion, "title" | "authors">, all: Book[]): boolean {
  const key = titleKey(s.title);
  const names = new Set(s.authors.map(surname));
  return all.some((b) => titleKey(b.title) === key && (names.size === 0 || b.authors.length === 0 || b.authors.some((a) => names.has(surname(a)))));
}

/**
 * Turns Claude's answer into books: unknown or repeated refs are dropped, and so is any "new"
 * book you already have, whatever Claude was told.
 */
export function resolveAnswer(answer: SimilarAnswer, candidates: Book[], all: Book[]): SimilarBooks {
  const seen = new Set<string>();
  const fromShelves = answer.fromShelves.flatMap(({ ref, reason }) => {
    const book = candidates[Number(/^b(\d+)$/.exec(ref.trim())?.[1]) - 1];
    if (!book || seen.has(book.id)) return [];
    seen.add(book.id);
    return [{ book, reason: reason.trim() }];
  });

  const known = new Set(all.flatMap((b) => b.genres));
  const newBooks = answer.newBooks
    .map((s) => ({
      title: s.title.trim(),
      authors: s.authors.map((a) => a.trim()).filter(Boolean),
      ...(s.year ? { year: s.year } : {}),
      genres: s.genres.filter((g) => known.has(g)).slice(0, 3),
      reason: s.reason.trim(),
    }))
    .filter((s, i, list) => s.title && !alreadyHave(s, all) && list.findIndex((o) => titleKey(o.title) === titleKey(s.title)) === i);

  return { fromShelves: fromShelves.slice(0, SHELF_PICKS), newBooks: newBooks.slice(0, NEW_PICKS) };
}
