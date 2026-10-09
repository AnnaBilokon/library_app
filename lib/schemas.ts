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
    description: z.string().trim().max(20_000).optional(),
    wanted: z.boolean().optional(),
    wishPrice: optionalNumber(z.number().min(0)),
    whereToBuy: optionalText,
    wishlistReason: optionalText,
    /** Only used when creating a book: dates for its first reading. */
    startedAt: isoDate.optional().or(z.literal("")),
    finishedAt: isoDate.optional().or(z.literal("")),
    /** Only when creating a book you didn't finish: where you stopped and why. */
    stoppedPage: optionalNumber(z.number().int("Whole pages only.").min(0).max(100_000)),
    stopReason: z.string().trim().max(2000).optional(),
  })
  .refine((v) => !v.startedAt || !v.finishedAt || v.finishedAt >= v.startedAt, {
    path: ["finishedAt"],
    message: "Can't finish before you started.",
  });

/** Form values (what the inputs hold) vs. validated output. */
export type BookFormValues = z.input<typeof bookInputSchema>;
export type BookInput = z.output<typeof bookInputSchema>;

/** Progress as a page number or a percentage (never both). */
export const progressSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("page"), value: z.number().int("Whole pages only.").min(0).max(100_000) }),
  z.object({ mode: z.literal("percent"), value: z.number().min(0).max(100, "At most 100%.") }),
]);
export type ProgressInput = z.infer<typeof progressSchema>;

export const stopReasonSchema = z.string().trim().max(2000).optional();
export const reviewSchema = z.string().trim().max(20_000);

export const readingInputSchema = z
  .object({
    startedAt: isoDate.optional().or(z.literal("")),
    finishedAt: isoDate.optional().or(z.literal("")),
    outcome: z.enum(["finished", "abandoned", "in-progress"]),
    /** Current page (in progress) or where you stopped (did not finish). */
    progress: progressSchema.nullable().optional(),
    stopReason: stopReasonSchema,
    rating: z.number().min(0.5).max(5).multipleOf(0.5).nullable().optional(),
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
    // A wishlist book is one you don't have yet; it becomes owned when you mark it bought.
    owned: input.wanted ? false : input.owned,
    acquired_at: orNull(input.acquiredAt),
    purchase_price: input.purchasePrice ?? null,
    notes: textOrNull(input.notes),
    description: textOrNull(input.description),
    ...(input.wanted === undefined
      ? {}
      : {
          wanted: input.wanted,
          wish_price: input.wishPrice ?? null,
          where_to_buy: textOrNull(input.whereToBuy),
          wishlist_reason: textOrNull(input.wishlistReason),
        }),
  };
}

export function progressToRow(progress: ProgressInput | null | undefined): ReadingRowUpdate {
  return {
    progress_page: progress?.mode === "page" ? progress.value : null,
    progress_percent: progress?.mode === "percent" ? progress.value : null,
    progress_updated_at: progress ? new Date().toISOString() : null,
  };
}

export function readingInputToRow(input: ReadingInput): ReadingRowUpdate {
  const finished = input.outcome === "finished";
  return {
    started_at: orNull(input.startedAt),
    finished_at: input.outcome === "in-progress" ? null : orNull(input.finishedAt),
    outcome: input.outcome === "in-progress" ? null : input.outcome,
    // A finished reading has no "where you are" or "why you stopped".
    ...progressToRow(finished ? null : input.progress),
    stop_reason: input.outcome === "abandoned" ? textOrNull(input.stopReason) : null,
    // Only a reading that ended can be rated.
    rating: input.outcome === "in-progress" ? null : (input.rating ?? null),
  };
}
