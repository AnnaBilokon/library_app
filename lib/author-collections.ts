import { isSold } from "@/lib/selling";
import type { Book } from "@/lib/types";

export interface AuthorCollection {
  author: string;
  /** Books you have: on your shelves, or read (even if no longer yours). */
  have: Book[];
  /** Of those, the ones you've read. */
  read: number;
  /** Books by this author on your wishlist. */
  wanted: Book[];
}

const isRead = (b: Book) => b.timesRead > 0 || b.status === "finished";
/** "Have" = it's on your shelf, or you've read it (borrowed, sold, ebook…). */
const have = (b: Book) => !b.wanted && ((b.owned && !isSold(b)) || isRead(b));
const byTitle = (a: Book, b: Book) => a.title.localeCompare(b.title, "uk");

/**
 * Authors you collect: everyone with at least two books between what you have and what's on your
 * wishlist, most books first. A co-written book counts for each author.
 */
export function authorCollections(books: Book[], min = 2): AuthorCollection[] {
  const byAuthor = new Map<string, { have: Book[]; wanted: Book[] }>();
  for (const b of books) {
    const kind = b.wanted ? "wanted" : have(b) ? "have" : null;
    if (!kind) continue;
    for (const a of b.authors) {
      const entry = byAuthor.get(a) ?? { have: [], wanted: [] };
      entry[kind].push(b);
      byAuthor.set(a, entry);
    }
  }
  return [...byAuthor]
    .map(([author, e]) => ({ author, have: e.have.sort(byTitle), read: e.have.filter(isRead).length, wanted: e.wanted.sort(byTitle) }))
    .filter((c) => c.have.length + c.wanted.length >= min)
    .sort((a, b) => b.have.length + b.wanted.length - (a.have.length + a.wanted.length) || a.author.localeCompare(b.author, "uk"));
}
