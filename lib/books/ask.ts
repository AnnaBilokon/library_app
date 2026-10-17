import { z } from "zod";
import { countryName } from "@/lib/countries";
import { BOOK_FORMATS, BOOK_STATUSES } from "@/lib/types";
import { normalize, SORT_KEYS, type BookFilters, type FacetOption, type SortDir, type SortKey } from "./filters";
import { languageLabel } from "./labels";

/**
 * "Ask your library": Claude turns a question in your own words into the Library's existing
 * filters, so the answer is an ordinary filtered view (chips you can remove, a URL you can share).
 */

/** Claude's answer: every filter, null or empty when the question doesn't touch it. */
export const askAnswerSchema = z.object({
  status: z.array(z.enum(BOOK_STATUSES)),
  genres: z.array(z.string()),
  tags: z.array(z.string()),
  author: z.string().nullable(),
  languages: z.array(z.string()),
  formats: z.array(z.enum(BOOK_FORMATS)),
  publishers: z.array(z.string()),
  series: z.string().nullable(),
  countries: z.array(z.string()),
  favorite: z.boolean().nullable(),
  rereadOnly: z.boolean().nullable(),
  notOwned: z.boolean().nullable(),
  ratingMin: z.number().nullable(),
  ratingMax: z.number().nullable(),
  pagesMin: z.number().nullable(),
  pagesMax: z.number().nullable(),
  finishedFrom: z.string().nullable(),
  finishedTo: z.string().nullable(),
  text: z.string().nullable(),
  sort: z.enum(SORT_KEYS).nullable(),
  sortDir: z.enum(["asc", "desc"]).nullable(),
  understood: z.string(),
});
export type AskAnswer = z.infer<typeof askAnswerSchema>;

export const ASK_SYSTEM = `You turn a reader's question about their own library into filters for their Library view. You never answer the question yourself: the app shows the books that match the filters.

Filters (leave a filter empty or null unless the question asks for it):
- status: to-read (not started; "haven't read", "unread"), reading, paused, finished ("read", "finished"), abandoned (did not finish).
- genres, tags, author, publishers, series, languages, countries: only values from the lists given, written exactly as listed. Tags are the reader's own moods and themes, in Ukrainian; map moods ("cozy", "dark", "light read") to the closest tags. Countries are the authors' countries (codes).
- favorite (true for favourites), rereadOnly (true for books read more than once), notOwned (true only for books they read but don't own: borrowed, library, ebooks).
- ratingMin / ratingMax: the reader's own rating, 0.5 to 5 ("rated 4+" means ratingMin 4).
- pagesMin / pagesMax: "short" means at most about 250 pages, "long" at least about 500.
- finishedFrom / finishedTo: days (yyyy-mm-dd) the book was finished, worked out from today's date ("last summer", "in March", "this year").
- text: a few words to search titles, authors and notes, only for what no other filter can express.
- sort and sortDir when the question implies an order; sort is one of: ${SORT_KEYS.join(", ")}. Superlatives ("the longest", "the best rated", "the latest") are only a sort: don't also add a pages, rating or date filter for them.

Almost every book in this library is in Ukrainian, so "Ukrainian books" usually means books by Ukrainian authors (countries: UA), not the language. Prefer fewer, surer filters over many guesses.

"understood": one short sentence saying how you read the question, written in the same language as the question (an English question gets an English sentence, a Ukrainian one a Ukrainian sentence). Keep filter values as they are, e.g. "Unread books under 250 pages tagged затишна історія".`;

export interface AskOptions {
  genres: FacetOption[];
  tags: string[];
  authors: FacetOption[];
  publishers: FacetOption[];
  languages: FacetOption[];
  countries: string[];
  series: FacetOption[];
}

/** The question with today's date and the values each filter can take in this library. */
export function askPrompt(question: string, options: AskOptions, today: string): string {
  const list = (items: FacetOption[]) => items.map((o) => o.value).join("; ") || "(none)";
  return [
    `Today is ${today}.`,
    `<genres>\n${list(options.genres)}\n</genres>`,
    `<tags>\n${options.tags.join("; ") || "(none)"}\n</tags>`,
    `<authors>\n${list(options.authors)}\n</authors>`,
    `<publishers>\n${list(options.publishers)}\n</publishers>`,
    `<series>\n${list(options.series)}\n</series>`,
    `<languages>\n${options.languages.map((o) => `${o.value} (${languageLabel(o.value)}, ${o.count} books)`).join("; ")}\n</languages>`,
    `<countries>\n${options.countries.map((c) => `${c} (${countryName(c)})`).join("; ") || "(none)"}\n</countries>`,
    `<question>\n${question}\n</question>`,
  ].join("\n\n");
}

export interface AskResult {
  filters: Partial<BookFilters>;
  sort?: SortKey;
  dir?: SortDir;
  understood: string;
}

const isoDate = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null);
const inRange = (v: number | null, min: number, max: number) => (v !== null && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : null);

/**
 * Claude's answer as Library filters. Values must exist in this library (matched ignoring case
 * and accents, then written the library's way); anything else is dropped rather than leaving an
 * empty list for a value that doesn't exist.
 */
export function resolveAsk(answer: AskAnswer, options: AskOptions): AskResult {
  const pick = (wanted: string[], from: string[]) => {
    const byKey = new Map(from.map((v) => [normalize(v), v]));
    return [...new Set(wanted.flatMap((w) => byKey.get(normalize(w)) ?? []))];
  };
  const values = (items: FacetOption[]) => items.map((o) => o.value);
  const one = (wanted: string | null, from: string[]) => (wanted ? (pick([wanted], from)[0] ?? null) : null);

  const ratingMin = inRange(answer.ratingMin, 0.5, 5);
  const ratingMax = inRange(answer.ratingMax, 0.5, 5);
  const pagesMin = inRange(answer.pagesMin, 1, 100_000);
  const pagesMax = inRange(answer.pagesMax, 1, 100_000);

  const filters: Partial<BookFilters> = {
    q: answer.text?.trim().slice(0, 200) ?? "",
    status: answer.status,
    genre: pick(answer.genres, values(options.genres)),
    tag: pick(answer.tags, options.tags),
    author: one(answer.author, values(options.authors)),
    language: pick(answer.languages, values(options.languages)),
    format: answer.formats,
    publisher: pick(answer.publishers, values(options.publishers)),
    series: one(answer.series, values(options.series)),
    country: pick(answer.countries.map((c) => c.toUpperCase()), options.countries),
    favorite: answer.favorite ? true : null,
    reread: answer.rereadOnly ? true : null,
    owned: answer.notOwned ? false : null,
    ratingMin: ratingMin !== null ? Math.round(ratingMin * 2) / 2 : null,
    ratingMax: ratingMax !== null ? Math.round(ratingMax * 2) / 2 : null,
    pagesMin: pagesMin !== null ? Math.round(pagesMin) : null,
    pagesMax: pagesMax !== null ? Math.round(pagesMax) : null,
    finishedFrom: isoDate(answer.finishedFrom),
    finishedTo: isoDate(answer.finishedTo),
  };
  return {
    filters,
    ...(answer.sort ? { sort: answer.sort, dir: answer.sortDir ?? "desc" } : {}),
    understood: answer.understood.trim().slice(0, 300),
  };
}
