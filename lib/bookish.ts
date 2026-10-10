import type { Book } from "@/lib/types";

/** Pages assumed for a book without a page count (so the fun facts still mean something). */
export const ASSUMED_PAGES = 300;
/** War and Peace, in a typical edition. */
export const WAR_AND_PEACE_PAGES = 1225;
const WORDS_PER_PAGE = 275;
const PAGES_PER_HOUR = 40;
/** Thickness of one page (half a leaf of ordinary book paper) plus covers, in centimetres. */
const CM_PER_PAGE = 0.0065;
const CM_PER_COVER = 0.3;

/** Things to compare your stack of books with, shortest first (heights in centimetres). */
const THINGS: { name: string; plural: string; cm: number }[] = [
  { name: "coffee mug", plural: "coffee mugs", cm: 9.5 },
  { name: "cat", plural: "cats", cm: 25 },
  { name: "guitar", plural: "guitars", cm: 100 },
  { name: "fridge", plural: "fridges", cm: 180 },
  { name: "giraffe", plural: "giraffes", cm: 550 },
  { name: "lighthouse", plural: "lighthouses", cm: 3000 },
];

export interface ShelfBook {
  id: string;
  title: string;
  authors: string[];
  pages?: number;
  finishedAt: string;
  /** 1–5: which jacket colour from the palette to paint the spine. */
  jacket: number;
}

export interface BookishFacts {
  books: number;
  pages: number;
  /** Books whose pages were assumed (no page count). */
  assumed: number;
  stackCm: number;
  /** "about 1.5 cats tall" */
  stackLike: { count: number; thing: string };
  warAndPeace: number;
  words: number;
  hours: number;
  longest: ShelfBook | null;
  shortest: ShelfBook | null;
}

/** Stable 1–5 from a book id, so a spine keeps its colour between visits. */
export function jacketFor(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (h % 5) + 1;
}

/** Every finished reading dated in the year, oldest first (a re-read is a second spine). */
export function shelfBooks(books: Book[], year: number): ShelfBook[] {
  return books
    .filter((b) => !b.wanted)
    .flatMap((b) =>
      b.readings
        .filter((r) => r.outcome === "finished" && r.finishedAt?.startsWith(String(year)))
        .map((r) => ({ id: b.id, title: b.title, authors: b.authors, pages: b.pages, finishedAt: r.finishedAt!, jacket: jacketFor(b.id) })),
    )
    .sort((a, b) => a.finishedAt.localeCompare(b.finishedAt));
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function compareHeight(cm: number): { count: number; thing: string } {
  // The biggest thing your stack is at least as tall as (or the smallest, for a tiny stack).
  const thing = [...THINGS].reverse().find((t) => cm >= t.cm) ?? THINGS[0];
  const count = round1(cm / thing.cm);
  return { count, thing: count === 1 ? thing.name : thing.plural };
}

/** Fun facts about the books on the shelf. */
export function bookishFacts(shelf: ShelfBook[]): BookishFacts {
  const assumed = shelf.filter((b) => !b.pages).length;
  const pages = shelf.reduce((s, b) => s + (b.pages ?? ASSUMED_PAGES), 0);
  const stackCm = round1(pages * CM_PER_PAGE + shelf.length * CM_PER_COVER);
  const known = shelf.filter((b) => b.pages);
  const byPages = [...known].sort((a, b) => b.pages! - a.pages!);
  return {
    books: shelf.length,
    pages,
    assumed,
    stackCm,
    stackLike: compareHeight(stackCm),
    warAndPeace: round1(pages / WAR_AND_PEACE_PAGES),
    words: Math.round((pages * WORDS_PER_PAGE) / 1000) * 1000,
    hours: Math.round(pages / PAGES_PER_HOUR),
    longest: byPages[0] ?? null,
    shortest: byPages.length > 1 ? byPages.at(-1)! : null,
  };
}

export interface GenreSlice {
  genre: string;
  count: number;
}

/** How many genres get their own colour; past that they share "Other" (globals.css --genre-1..14). */
export const GENRE_COLOURS = 14;

/** This year's genres, most read first: every one of them (only past fourteen does the rest become "Other"). */
export function genreSlices(books: Book[], year: number, top = GENRE_COLOURS): GenreSlice[] {
  const counts = new Map<string, number>();
  for (const b of books)
    if (!b.wanted && b.readings.some((r) => r.outcome === "finished" && r.finishedAt?.startsWith(String(year))))
      for (const g of b.genres.length ? b.genres : ["No genre"]) counts.set(g, (counts.get(g) ?? 0) + 1);
  const sorted = [...counts].map(([genre, count]) => ({ genre, count })).sort((a, b) => b.count - a.count || a.genre.localeCompare(b.genre, "uk"));
  if (sorted.length <= top + 1) return sorted;
  const rest = sorted.slice(top).reduce((s, g) => s + g.count, 0);
  return [...sorted.slice(0, top), { genre: OTHER_GENRE, count: rest }];
}

/** "Other" and its colour slot, shared by the donut and the tiles. */
export const OTHER_GENRE = "Other";

export interface GenreTile {
  id: string;
  title: string;
  authors: string[];
  finishedAt: string;
  /** The book's main genre (its first); "Other" only past fourteen genres. */
  genre: string;
  /** Colour slot: 1–14 in the order of the year's genres, 0 for "Other". */
  slot: number;
}

/**
 * The year's finished books in reading order, each coloured by its main genre, using the same
 * colour for a genre as the donut does (so the two always agree).
 */
export function genreTiles(books: Book[], year: number): { tiles: GenreTile[]; legend: { genre: string; slot: number; count: number }[] } {
  const slices = genreSlices(books, year);
  const slotOf = new Map(slices.filter((s) => s.genre !== OTHER_GENRE).map((s, i) => [s.genre, i + 1]));
  const byId = new Map(books.map((b) => [b.id, b]));
  const tiles = shelfBooks(books, year).map((s) => {
    const main = byId.get(s.id)?.genres[0] ?? "No genre";
    const slot = slotOf.get(main) ?? 0;
    return { id: s.id, title: s.title, authors: s.authors, finishedAt: s.finishedAt, genre: slot ? main : OTHER_GENRE, slot };
  });
  const counts = new Map<string, { genre: string; slot: number; count: number }>();
  for (const t of tiles) counts.set(t.genre, { genre: t.genre, slot: t.slot, count: (counts.get(t.genre)?.count ?? 0) + 1 });
  // Legend in colour order, "Other" last.
  const legend = [...counts.values()].sort((a, b) => (a.slot || 99) - (b.slot || 99));
  return { tiles, legend };
}
