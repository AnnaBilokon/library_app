import { z } from "zod";
import { normalizeIsbn } from "@/lib/isbn";
import type { Database } from "@/lib/database.types";
import { BOOK_FORMATS, BOOK_STATUSES } from "@/lib/types";

/**
 * Validation shared by the browser (react-hook-form) and the server (Server Actions).
 * The server always validates again: Server Actions are public endpoints.
 */

const isoDate = z.iso.date({ error: "Use a valid date." });
const optionalText = z.string().trim().max(5000).optional();
const optionalNumber = (schema: z.ZodNumber) => z.union([schema, z.nan().transform(() => undefined)]).optional();

export const bookInputSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required.").max(500),
    authors: z.array(z.string().trim().min(1).max(200)).max(20),
    status: z.enum(BOOK_STATUSES),
    rating: z.number().min(0.5).max(5).multipleOf(0.5).nullable().optional(),
    favorite: z.boolean(),
    genres: z.array(z.string().trim().min(1).max(100)).max(20),
    tags: z.array(z.string().trim().min(1).max(100)).max(30),
    language: z.string().regex(/^[a-z]{2,3}$/, "Pick a language.").optional().or(z.literal("")),
    format: z.enum(BOOK_FORMATS).optional().or(z.literal("")),
    publisher: optionalText,
    publishedYear: optionalNumber(z.number().int("Whole years only.").min(0).max(2100)),
    pages: optionalNumber(z.number().int("Whole pages only.").positive("Must be at least 1.")),
    isbn: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || normalizeIsbn(v) !== null, "That isn't a valid ISBN-10 or ISBN-13."),
    series: optionalText,
    seriesIndex: optionalNumber(z.number().positive()),
    owned: z.boolean(),
    acquiredAt: isoDate.optional().or(z.literal("")),
    purchasePrice: optionalNumber(z.number().min(0)),
    notes: optionalText,
    /** Only used when creating a book: dates for its first reading. */
    startedAt: isoDate.optional().or(z.literal("")),
    finishedAt: isoDate.optional().or(z.literal("")),
  })
  .refine((v) => !v.startedAt || !v.finishedAt || v.finishedAt >= v.startedAt, {
    path: ["finishedAt"],
    message: "Can't finish before you started.",
  });

/** Form values (what the inputs hold) vs. validated output. */
export type BookFormValues = z.input<typeof bookInputSchema>;
export type BookInput = z.output<typeof bookInputSchema>;

export const readingInputSchema = z
  .object({
    startedAt: isoDate.optional().or(z.literal("")),
    finishedAt: isoDate.optional().or(z.literal("")),
    outcome: z.enum(["finished", "abandoned", "in-progress"]),
  })
  .refine((v) => !v.startedAt || !v.finishedAt || v.finishedAt >= v.startedAt, {
    path: ["finishedAt"],
    message: "Can't finish before you started.",
  })
  .refine((v) => v.outcome !== "in-progress" || !v.finishedAt, {
    path: ["finishedAt"],
    message: "A reading in progress has no finish date.",
  });

export type ReadingFormValues = z.input<typeof readingInputSchema>;
export type ReadingInput = z.output<typeof readingInputSchema>;

type BookRowUpdate = Database["public"]["Tables"]["books"]["Update"];
type ReadingRowUpdate = Database["public"]["Tables"]["readings"]["Update"];

const orNull = <T>(v: T | undefined | ""): T | null => (v === undefined || v === "" ? null : v);
const textOrNull = (v: string | undefined) => (v?.trim() ? v.trim() : null);
const uniq = (values: string[]) => [...new Set(values.map((v) => v.trim()).filter(Boolean))];

/** Validated form input → DB columns (the reverse of rowToBook). */
export function bookInputToRow(input: BookInput): BookRowUpdate {
  return {
    title: input.title,
    authors: uniq(input.authors),
    status: input.status,
    rating: input.rating ?? null,
    favorite: input.favorite,
    genres: uniq(input.genres),
    tags: uniq(input.tags),
    language: orNull(input.language),
    format: orNull(input.format),
    publisher: textOrNull(input.publisher),
    published_year: input.publishedYear ?? null,
    pages: input.pages ?? null,
    isbn: input.isbn ? normalizeIsbn(input.isbn) : null,
    series: textOrNull(input.series),
    series_index: input.seriesIndex ?? null,
    owned: input.owned,
    acquired_at: orNull(input.acquiredAt),
    purchase_price: input.purchasePrice ?? null,
    notes: textOrNull(input.notes),
  };
}

export function readingInputToRow(input: ReadingInput): ReadingRowUpdate {
  return {
    started_at: orNull(input.startedAt),
    finished_at: input.outcome === "in-progress" ? null : orNull(input.finishedAt),
    outcome: input.outcome === "in-progress" ? null : input.outcome,
  };
}
