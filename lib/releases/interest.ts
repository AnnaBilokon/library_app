import { z } from "zod";
import { normalize } from "@/lib/books/filters";
import type { Edition } from "@/lib/catalog/editions";
import type { Book } from "@/lib/types";

/**
 * "Books you may like" from new releases: a reader's profile from their own reading, a quick
 * first pass without Claude, then Claude picks the few that are really likely to interest them.
 */

/** Claude picks at most this many, from at most this many first-pass candidates. */
export const MAX_PICKS = 5;
export const MAX_CANDIDATES = 30;

export interface ReaderProfile {
  /** Genres of what they read lately, weighted by how much they liked it (shares add up to 1). */
  genres: { genre: string; weight: number }[];
  /** Authors they come back to or rated highly. */
  authors: string[];
  tags: string[];
  /** A few books they loved, so Claude gets their taste. */
  loved: string[];
}

/**
 * The profile from books finished in the last three years (weighted by rating: a 5★ book counts
 * more than a 2★ one), favourite authors (rated 4+, favourites, or read twice or more), tags.
 */
export function readerProfile(books: Book[], today: string): ReaderProfile {
  const since = `${Number(today.slice(0, 4)) - 3}${today.slice(4)}`;
  const recent = books.filter((b) => b.readings.some((r) => r.outcome === "finished" && r.finishedAt && r.finishedAt >= since));
  const weightOf = (b: Book) => (b.rating === undefined ? 1 : Math.max(0.25, (b.rating - 1.5) / 2));

  const genreWeight = new Map<string, number>();
  for (const b of recent) for (const g of b.genres) genreWeight.set(g, (genreWeight.get(g) ?? 0) + weightOf(b) / b.genres.length);
  const total = [...genreWeight.values()].reduce((a, b) => a + b, 0) || 1;
  const genres = [...genreWeight]
    .map(([genre, w]) => ({ genre, weight: Math.round((w / total) * 100) / 100 }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 6);

  const authorScore = new Map<string, number>();
  for (const b of books) {
    const liked = b.favorite || (b.rating ?? 0) >= 4;
    for (const a of b.authors) authorScore.set(a, (authorScore.get(a) ?? 0) + (b.timesRead > 0 ? 1 : 0) + (liked ? 2 : 0));
  }
  const authors = [...authorScore].filter(([, s]) => s >= 2).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([a]) => a);

  const tagCount = new Map<string, number>();
  for (const b of recent) for (const t of b.tags) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
  const tags = [...tagCount].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t]) => t);

  const loved = books
    .filter((b) => b.favorite || (b.rating ?? 0) >= 4.5)
    .sort((a, b) => (b.lastFinishedAt ?? "").localeCompare(a.lastFinishedAt ?? ""))
    .slice(0, 15)
    .map((b) => `${b.title}${b.authors.length ? ` — ${b.authors.join(", ")}` : ""}`);

  return { genres, authors, tags, loved };
}

/** The first pass: +5 for an author they love, plus the weight of each genre they read. */
export function preScore(edition: Pick<Edition, "authors" | "genres">, profile: ReaderProfile): number {
  const authors = new Set(profile.authors.map(normalize));
  const byAuthor = edition.authors.some((a) => authors.has(normalize(a))) ? 5 : 0;
  const byGenre = edition.genres.reduce((sum, g) => sum + (profile.genres.find((p) => normalize(p.genre) === normalize(g))?.weight ?? 0), 0);
  return byAuthor + byGenre * 4;
}

/** The candidates worth asking Claude about, best first: some first-pass score, at most MAX_CANDIDATES. */
export function shortlist<T extends Pick<Edition, "authors" | "genres" | "createdAt">>(editions: T[], profile: ReaderProfile): T[] {
  return editions
    .map((e) => ({ e, score: preScore(e, profile) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.e.createdAt.localeCompare(a.e.createdAt))
    .slice(0, MAX_CANDIDATES)
    .map(({ e }) => e);
}

export const picksAnswerSchema = z.object({ picks: z.array(z.object({ ref: z.string(), reason: z.string() })) });
export type PicksAnswer = z.infer<typeof picksAnswerSchema>;

export const PICKS_SYSTEM = `You tell a reader about new and upcoming books worth their attention, using what they read and love.

From the new releases (refs r1, r2, …) pick at most ${MAX_PICKS} that this reader is genuinely likely to want: a new book by an author they love, or one close to the genres, themes and books they rate highly. Fewer is better than a stretch; pick none if nothing fits well.

For each pick write one short sentence (under 20 words) saying why it's for them, in the language of the book's title, tied to their reading (an author, a genre or a book they loved). No plot summaries.`;

const clip = (text: string | undefined, max: number) => {
  const t = text?.replace(/\s+/g, " ").trim();
  return t && t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

export function picksPrompt(profile: ReaderProfile, candidates: Edition[]): string {
  const list = (items: string[]) => items.join("; ") || "(none)";
  return [
    `<reader>\nGenres they read most (share): ${list(profile.genres.map((g) => `${g.genre} ${Math.round(g.weight * 100)}%`))}\nAuthors they love: ${list(profile.authors)}\nTheir tags: ${list(profile.tags)}\nBooks they loved: ${list(profile.loved)}\n</reader>`,
    `<new_releases>\n${candidates
      .map((e, i) => [`r${i + 1}`, e.title, e.authors.join(", "), e.genres.join(", "), clip(e.description, 300)].filter(Boolean).join(" | "))
      .join("\n")}\n</new_releases>`,
  ].join("\n\n");
}

/** Claude's picks back to editions: known refs only, each once, at most MAX_PICKS. */
export function resolvePicks(answer: PicksAnswer, candidates: Edition[]): { editionId: string; reason: string }[] {
  const seen = new Set<string>();
  const out: { editionId: string; reason: string }[] = [];
  for (const { ref, reason } of answer.picks) {
    const e = candidates[Number(/^r(\d+)$/.exec(ref.trim())?.[1]) - 1];
    if (!e || seen.has(e.id) || !reason.trim()) continue;
    seen.add(e.id);
    out.push({ editionId: e.id, reason: reason.trim().slice(0, 300) });
  }
  return out.slice(0, MAX_PICKS);
}
