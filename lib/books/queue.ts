import type { Book } from "@/lib/types";

/** The "Up next" queue in order; the first book is the pinned next read. */
export function queueOf(books: Book[]): Book[] {
  return books
    .filter((b) => b.queuePosition !== undefined)
    .sort((a, b) => (a.queuePosition ?? 0) - (b.queuePosition ?? 0));
}

export type QueueChange = "append" | "pin" | "remove";

/** The new queue order (book ids, first = next read) after adding, pinning or removing a book. */
export function nextQueueOrder(current: string[], bookId: string, change: QueueChange): string[] {
  const rest = current.filter((id) => id !== bookId);
  if (change === "pin") return [bookId, ...rest];
  if (change === "append") return current.includes(bookId) ? current : [...rest, bookId];
  return rest;
}

/** Statuses that take a book out of the queue (you've started it, or you're done with it). */
export const LEAVES_QUEUE = new Set(["reading", "finished", "abandoned"]);
