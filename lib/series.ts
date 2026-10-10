import type { Book } from "@/lib/types";
import { isSold } from "@/lib/selling";

/** Series name → how many books it has (where you've set it). */
export type SeriesTotals = Record<string, number>;

/** Where you are with one volume of a series. */
export type VolumeState = "read" | "reading" | "owned" | "wishlist" | "missing";

export interface SeriesVolume {
  index: number;
  /** Your books with this number (usually one; two editions are both listed). */
  books: Book[];
  state: VolumeState;
}

export interface SeriesSummary {
  name: string;
  authors: string[];
  /** Volumes 1…N, where N is the total you set or the highest number you have. */
  volumes: SeriesVolume[];
  /** Books in the series without a number. */
  unnumbered: Book[];
  /** The total you set, if any. */
  total: number | null;
  read: number;
  /** The first volume you haven't read, if you have it (on your shelf, or reading). */
  next: { index: number; book: Book } | null;
  /** Numbers you don't have yet (not on your shelves, not read, not on the wishlist). */
  missing: number[];
  /** Finished needs the total; without it, reading every volume you have is "caught up". */
  status: "reading" | "not-started" | "caught-up" | "finished";
}

const isRead = (b: Book) => b.timesRead > 0 || b.status === "finished";
const isReading = (b: Book) => b.status === "reading" || b.status === "paused";
const onShelf = (b: Book) => b.owned && !isSold(b);

/** The best state across the books for one volume: read beats reading beats owned beats wishlist. */
function stateOf(books: Book[]): VolumeState {
  if (books.some(isRead)) return "read";
  if (books.some(isReading)) return "reading";
  if (books.some((b) => !b.wanted && onShelf(b))) return "owned";
  if (books.some((b) => b.wanted)) return "wishlist";
  return "missing";
}

const ORDER = { reading: 0, "caught-up": 1, "not-started": 2, finished: 3 } as const;

/**
 * Every series in your library (and wishlist), with each volume's state. Series you're in the
 * middle of come first, then ones you've caught up with, then ones you haven't started, then
 * finished ones.
 */
export function seriesTracker(books: Book[], totals: SeriesTotals = {}): SeriesSummary[] {
  const bySeries = new Map<string, Book[]>();
  for (const b of books) if (b.series?.trim()) bySeries.set(b.series.trim(), [...(bySeries.get(b.series.trim()) ?? []), b]);

  return [...bySeries]
    .map(([name, list]) => {
      const numbered = list.filter((b) => b.seriesIndex !== undefined && Number.isInteger(b.seriesIndex) && b.seriesIndex > 0);
      const total = totals[name] ?? null;
      const highest = Math.max(0, ...numbered.map((b) => b.seriesIndex!));
      const count = Math.max(total ?? 0, highest);
      const volumes = Array.from({ length: count }, (_, i) => {
        const vb = numbered.filter((b) => b.seriesIndex === i + 1);
        return { index: i + 1, books: vb, state: stateOf(vb) };
      });
      const read = volumes.filter((v) => v.state === "read").length;
      const firstUnread = volumes.find((v) => v.state !== "read");
      const nextBook = firstUnread?.books.find((b) => isReading(b)) ?? firstUnread?.books.find((b) => !b.wanted && onShelf(b));
      const anyRead = read > 0 || list.some(isRead);
      const allRead = count > 0 && read === count;
      const status = allRead ? (total !== null ? "finished" : "caught-up") : anyRead ? "reading" : "not-started";
      const authors = [...new Set(list.flatMap((b) => b.authors))];
      return {
        name,
        authors,
        volumes,
        unnumbered: list.filter((b) => !numbered.includes(b)),
        total,
        read,
        next: firstUnread && nextBook ? { index: firstUnread.index, book: nextBook } : null,
        missing: volumes.filter((v) => v.state === "missing").map((v) => v.index),
        status,
      } satisfies SeriesSummary;
    })
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.name.localeCompare(b.name, "uk"));
}
