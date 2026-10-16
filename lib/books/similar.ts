import { z } from "zod";
import { poolBooks } from "@/lib/surprise";
import type { Book } from "@/lib/types";

/** How many books Claude may pick from your shelves. */
export const SHELF_PICKS = 4;

/** What Claude sends back. Picks refer to the numbered list ("b1", "b2", …) in the prompt. */
export const similarAnswerSchema = z.object({
  picks: z.array(z.object({ ref: z.string(), reason: z.string() })),
});
export type SimilarAnswer = z.infer<typeof similarAnswerSchema>;

export interface SimilarPick {
  book: Book;
  reason: string;
}

export const SIMILAR_SYSTEM = `You recommend books to one reader from their own shelves.

You get the book they're looking at, a numbered list of unread books they already own, and books they loved or gave up on.

From the unread list, pick up to ${SHELF_PICKS} books someone who reads this one would enjoy next. Look for a shared feel, themes, style or subject, not just the same genre; books sharing a genre or author come first in the list. Refer to them by their ref (b1, b2, …). Return fewer only when nothing on the list is close.

For every pick, write one short sentence (under 25 words, in English) saying why, tied to this book: what they share, not a summary of the plot.`;

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

/** The user message: this book, the unread shelf, and what the reader loved and dropped. */
export function similarPrompt(book: Book, candidates: Book[], all: Book[]): string {
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
    section("loved", loved),
    section("did_not_finish", dropped),
  ].join("\n\n");
}

/** Turns Claude's answer into books: unknown or repeated refs are dropped. */
export function resolveAnswer(answer: SimilarAnswer, candidates: Book[]): SimilarPick[] {
  const seen = new Set<string>();
  return answer.picks
    .flatMap(({ ref, reason }) => {
      const book = candidates[Number(/^b(\d+)$/.exec(ref.trim())?.[1]) - 1];
      if (!book || seen.has(book.id)) return [];
      seen.add(book.id);
      return [{ book, reason: reason.trim() }];
    })
    .slice(0, SHELF_PICKS);
}
