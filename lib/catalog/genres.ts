import { z } from "zod";
import { normalize } from "@/lib/books/filters";

/** At most this many genres per book, and books per request. */
export const GENRES_PER_BOOK = 2;
export const GENRE_BATCH = 20;

export interface GenreBook {
  id: string;
  title: string;
  authors: string[];
  description?: string;
}

export const genresAnswerSchema = z.object({
  books: z.array(z.object({ ref: z.string(), genres: z.array(z.string()) })),
});
export type GenresAnswer = z.infer<typeof genresAnswerSchema>;

export const GENRES_SYSTEM = `You sort books into a reader's own genres, so new releases can be filtered the same way as their library.

For each book (refs g1, g2, …) choose up to ${GENRES_PER_BOOK} genres from the genre list that clearly fit, judging by the description, title and author. Use only genres exactly as written in the list. Give none when nothing fits or there's too little to go on.`;

const clip = (text: string | undefined, max: number) => {
  const t = text?.replace(/\s+/g, " ").trim();
  return t && t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

export function genresPrompt(books: GenreBook[], genres: string[]): string {
  return [
    `<genre_list>\n${genres.join("\n")}\n</genre_list>`,
    `<books>\n${books.map((b, i) => [`g${i + 1}`, b.title, b.authors.join(", "), clip(b.description, 500)].filter(Boolean).join(" | ")).join("\n")}\n</books>`,
  ].join("\n\n");
}

/** Claude's answer back to books: only genres from the list (written the list's way), at most two, each book once. */
export function resolveGenres(answer: GenresAnswer, books: GenreBook[], genres: string[]): { id: string; genres: string[] }[] {
  const byKey = new Map(genres.map((g) => [normalize(g), g]));
  const out = new Map<string, string[]>();
  for (const { ref, genres: picked } of answer.books) {
    const book = books[Number(/^g(\d+)$/.exec(ref.trim())?.[1]) - 1];
    if (!book || out.has(book.id)) continue;
    const valid = [...new Set(picked.flatMap((g) => byKey.get(normalize(g)) ?? []))].slice(0, GENRES_PER_BOOK);
    out.set(book.id, valid);
  }
  return books.map((b) => ({ id: b.id, genres: out.get(b.id) ?? [] }));
}
