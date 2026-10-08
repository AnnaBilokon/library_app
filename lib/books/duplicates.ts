import type { Book } from "@/lib/types";
import { normalize } from "./filters";

/** "title|authors", ignoring case and accents. Books sharing a key are possible duplicates. */
export function duplicateKey(book: Pick<Book, "title" | "authors">): string {
  return `${normalize(book.title.trim())}|${book.authors.map((a) => normalize(a.trim())).join(", ")}`;
}

/** Ids of books that share a title and authors with at least one other book. */
export function findDuplicateIds(books: Book[]): Set<string> {
  const groups = new Map<string, string[]>();
  for (const b of books) {
    const key = duplicateKey(b);
    groups.set(key, [...(groups.get(key) ?? []), b.id]);
  }
  return new Set([...groups.values()].filter((ids) => ids.length > 1).flat());
}
