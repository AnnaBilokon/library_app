import { inLibrary } from "@/lib/selling";
import type { Book } from "@/lib/types";

/** Where "Surprise me" picks from. */
export const POOLS = ["unread", "all", "forgotten"] as const;
export type Pool = (typeof POOLS)[number];

/** Any genre, one genre, or "something different": a genre you haven't read lately. */
export type GenreChoice = { kind: "any" } | { kind: "genre"; genre: string } | { kind: "different" };

/** How many recent finishes decide what "something different" means. */
export const RECENT_FINISHES = 5;

const neverRead = (b: Book) => b.timesRead === 0 && b.status !== "abandoned";

/** Books that could be picked: in your library, and not the ones you're reading right now. */
export function poolBooks(books: Book[], pool: Pool): Book[] {
  const candidates = books.filter((b) => inLibrary(b) && b.status !== "reading" && b.status !== "paused");
  if (pool === "forgotten") return candidates.filter((b) => b.forgotten);
  if (pool === "unread") return candidates.filter((b) => b.owned && neverRead(b));
  return candidates;
}

/** Genres of the books you finished most recently (newest first). */
export function recentGenres(books: Book[], n = RECENT_FINISHES): string[] {
  const finished = books
    .filter((b) => b.lastFinishedAt)
    .sort((a, b) => b.lastFinishedAt!.localeCompare(a.lastFinishedAt!))
    .slice(0, n);
  return [...new Set(finished.flatMap((b) => b.genres))];
}

export function applyGenre(books: Book[], choice: GenreChoice, recent: string[]): Book[] {
  if (choice.kind === "genre") return books.filter((b) => b.genres.includes(choice.genre));
  // Something different: a book with a genre, none of which you've read lately.
  if (choice.kind === "different") return books.filter((b) => b.genres.length > 0 && !b.genres.some((g) => recent.includes(g)));
  return books;
}

/**
 * The pick, plus a reel of covers to spin past before it (ending on the pick). Books already shown
 * this session are skipped while others remain, so "Spin again" keeps finding new ones.
 * `random` is injectable for tests.
 */
export function spin(books: Book[], seen: Set<string>, reelLength = 28, random = Math.random): { pick: Book; reel: Book[] } | null {
  if (books.length === 0) return null;
  const fresh = books.filter((b) => !seen.has(b.id));
  const from = fresh.length > 0 ? fresh : books;
  const pick = from[Math.floor(random() * from.length)];
  const others = books.filter((b) => b.id !== pick.id);
  const reel = Array.from({ length: reelLength - 1 }, (_, i) => (others.length ? others[Math.floor(random() * others.length)] : pick) ?? books[i % books.length]);
  return { pick, reel: [...reel, pick] };
}
