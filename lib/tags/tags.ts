import { z } from "zod";

/** At most this many tags in your list, and suggested per book. */
export const TAG_LIST_MAX = 60;
export const TAGS_PER_BOOK = 4;
/** Books sent to Claude in one request when tagging the library. */
export const TAG_BATCH = 20;

/** Tags are lower-case with single spaces, so "Відьми" and "відьми " are the same tag. */
export function normalizeTag(tag: string): string {
  return tag.replace(/\s+/g, " ").trim().toLocaleLowerCase("uk").slice(0, 60);
}

/** A clean list: normalized, no blanks, no repeats, at most TAG_LIST_MAX. */
export function cleanTagList(tags: string[]): string[] {
  return [...new Set(tags.map(normalizeTag).filter(Boolean))].slice(0, TAG_LIST_MAX);
}

const clip = (text: string | undefined | null, max: number) => {
  const t = text?.replace(/\s+/g, " ").trim();
  return t && t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

/** What Claude needs to know about a book to tag it. */
export interface TaggableBook {
  id: string;
  title: string;
  authors: string[];
  genres: string[];
  description?: string | null;
  tags: string[];
}

// ───────────────────────── Proposing a tag list ─────────────────────────

export const tagListAnswerSchema = z.object({ tags: z.array(z.string()) });

export const TAG_LIST_SYSTEM = `You help a reader set up a small, consistent list of tags for their personal library, so they can later find books by mood and theme ("cozy books I haven't read").

Propose about 30 tags in Ukrainian, lower-case, one to three words each. Mix:
- moods and reading feel (for example: затишна історія, темна атмосфера, легке читання, повільна історія, емоційно важка);
- recurring themes and tropes in this library (for example: сильні жінки, родинні таємниці, книги про книги, війна, дорослішання).

Keep every tag the reader already has (fix only obvious duplicates, like the same word in different case). Don't propose genres the library already has (fantasy, history, romance…), formats, lengths or ratings: those have their own filters. Prefer tags that fit many books here over rare ones.`;

/** The reader's genres and existing tags, and a sample of books to see what the library is like. */
export function tagListPrompt(books: TaggableBook[], genres: string[]): string {
  const existing = cleanTagList(books.flatMap((b) => b.tags));
  // Up to 120 books spread over the library, enough to see its range without a huge prompt.
  const step = Math.max(1, Math.floor(books.length / 120));
  const sample = books.filter((_, i) => i % step === 0).slice(0, 120);
  return [
    `<existing_tags>\n${existing.join(", ") || "(none)"}\n</existing_tags>`,
    `<genres>\n${genres.join(", ")}\n</genres>`,
    `<books>\n${sample.map((b) => [b.title, b.authors.join(", "), clip(b.description, 160)].filter(Boolean).join(" | ")).join("\n")}\n</books>`,
  ].join("\n\n");
}

// ───────────────────────── Tagging books ─────────────────────────

export const tagBooksAnswerSchema = z.object({
  books: z.array(z.object({ ref: z.string(), tags: z.array(z.string()) })),
});
export type TagBooksAnswer = z.infer<typeof tagBooksAnswerSchema>;

export const TAG_BOOKS_SYSTEM = `You tag books in a reader's personal library with tags from their own tag list, so they can find books by mood and theme.

For each book (refs t1, t2, …), choose up to ${TAGS_PER_BOOK} tags from the tag list that clearly fit, judging by the description, genres, title and author. Use only tags exactly as written in the list. Fewer is better than a weak fit; give none when nothing fits or there's too little to go on.`;

export function tagBooksPrompt(books: TaggableBook[], tagList: string[]): string {
  return [
    `<tag_list>\n${tagList.join("\n")}\n</tag_list>`,
    `<books>\n${books
      .map((b, i) =>
        [
          `t${i + 1}`,
          b.title,
          b.authors.join(", "),
          b.genres.length && `genres: ${b.genres.join(", ")}`,
          b.tags.length && `already tagged: ${b.tags.join(", ")}`,
          clip(b.description, 500),
        ]
          .filter(Boolean)
          .join(" | "),
      )
      .join("\n")}\n</books>`,
  ].join("\n\n");
}

export interface TagSuggestion {
  bookId: string;
  /** New tags only (not ones the book already has), all from the tag list. */
  tags: string[];
}

/** Claude's answer back to books: only tags from the list, none the book already has, at most TAGS_PER_BOOK. */
export function resolveTagSuggestions(answer: TagBooksAnswer, books: TaggableBook[], tagList: string[]): TagSuggestion[] {
  const allowed = new Set(tagList.map(normalizeTag));
  const out = new Map<string, Set<string>>();
  for (const { ref, tags } of answer.books) {
    const book = books[Number(/^t(\d+)$/.exec(ref.trim())?.[1]) - 1];
    if (!book) continue;
    const have = new Set(book.tags.map(normalizeTag));
    const set = out.get(book.id) ?? new Set<string>();
    for (const t of tags.map(normalizeTag)) if (allowed.has(t) && !have.has(t) && set.size < TAGS_PER_BOOK) set.add(t);
    out.set(book.id, set);
  }
  return books.map((b) => ({ bookId: b.id, tags: [...(out.get(b.id) ?? [])] }));
}

/** A book's tags after adding `add` (no repeats, case-insensitive). */
export function mergeTags(current: string[], add: string[]): string[] {
  const seen = new Set(current.map(normalizeTag));
  return [...current, ...add.filter((t) => !seen.has(normalizeTag(t)) && seen.add(normalizeTag(t)))];
}

/** A book's tags after renaming `from` to `to` (merging when the book already has `to`). */
export function renameInTags(tags: string[], from: string, to: string): string[] {
  const f = normalizeTag(from);
  const renamed = tags.map((t) => (normalizeTag(t) === f ? to : t));
  return mergeTags([], renamed);
}
