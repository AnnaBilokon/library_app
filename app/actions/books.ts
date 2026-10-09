"use server";

// All book mutations. Each Server Action is a public HTTP endpoint, so every one checks the
// session (requireUser), validates its input with zod, and relies on RLS so a user can only
// ever touch their own rows. They return { ok, error } instead of throwing, so the UI can show
// a friendly toast.

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { LEAVES_QUEUE } from "@/lib/books/queue";
import { openReading, planStatusChange } from "@/lib/books/reading-logic";
import { getBook } from "@/lib/data/books";
import {
  bookInputSchema,
  bookInputToRow,
  progressSchema,
  progressToRow,
  readingInputSchema,
  readingInputToRow,
  reviewSchema,
  stopReasonSchema,
} from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import { BOOK_STATUSES } from "@/lib/types";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const id = z.uuid();
const isoDate = z.iso.date();
const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
const fail = (error: string): ActionResult<never> => ({ ok: false, error });

/** Every page shows book data, so refresh them all (this also refreshes the page you're on). */
function refreshAll() {
  revalidatePath("/", "layout");
}

function dbError(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "You already have a book with this ISBN.";
  return `Couldn't save: ${error.message}`;
}

export async function createBook(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = bookInputSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  const input = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("books")
    .insert({ ...bookInputToRow(input), title: input.title, user_id: user.id })
    .select("id")
    .single();
  if (error) return fail(dbError(error));

  // The first reading, unless the book is simply waiting to be read.
  if (input.status !== "to-read") {
    const outcome = input.status === "finished" || input.status === "abandoned" ? input.status : null;
    await supabase.from("readings").insert({
      book_id: data.id,
      user_id: user.id,
      started_at: input.startedAt || null,
      finished_at: outcome ? input.finishedAt || null : null,
      outcome,
    });
  }

  refreshAll();
  return ok({ id: data.id });
}

export async function updateBook(bookId: string, raw: unknown): Promise<ActionResult> {
  await requireUser();
  if (!id.safeParse(bookId).success) return fail("Unknown book.");
  const parsed = bookInputSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input.");

  const supabase = await createClient();
  const { error } = await supabase.from("books").update(bookInputToRow(parsed.data)).eq("id", bookId);
  if (error) return fail(dbError(error));
  refreshAll();
  return ok(undefined);
}

/** Optional details saved together with a status change. */
const statusDetailsSchema = z
  .object({
    /** Did not finish: where you stopped and why. */
    progress: progressSchema.nullable().optional(),
    reason: stopReasonSchema,
    /** Finished: the dates and your rating, from the finish dialog. */
    startedAt: isoDate.optional().or(z.literal("")),
    finishedAt: isoDate.optional().or(z.literal("")),
    rating: z.number().min(0.5).max(5).multipleOf(0.5).nullable().optional(),
  })
  .refine((d) => !d.startedAt || !d.finishedAt || d.finishedAt >= d.startedAt, "Can't finish before you started.");

/**
 * The book's main rating follows your most recent rated reading, so re-reads show how your
 * opinion changed while the book keeps your latest view.
 */
async function syncBookRating(supabase: Awaited<ReturnType<typeof createClient>>, bookId: string) {
  const { data } = await supabase
    .from("readings")
    .select("rating, finished_at, started_at, created_at")
    .eq("book_id", bookId)
    .not("rating", "is", null);
  const latest = (data ?? []).sort((a, b) =>
    (b.finished_at ?? b.started_at ?? b.created_at).localeCompare(a.finished_at ?? a.started_at ?? a.created_at),
  )[0];
  if (latest) await supabase.from("books").update({ rating: latest.rating }).eq("id", bookId);
}

/**
 * Change status and record the matching reading dates (see planStatusChange).
 * `details` carries the finish dialog's dates and rating, or the did-not-finish page and reason.
 */
export async function setBookStatus(bookId: string, status: string, today: string, details?: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const s = z.enum(BOOK_STATUSES).safeParse(status);
  if (!id.safeParse(bookId).success || !s.success || !isoDate.safeParse(today).success) return fail("Invalid input.");
  const d = statusDetailsSchema.optional().safeParse(details);
  if (!d.success) return fail(d.error.issues[0]?.message ?? "Invalid input.");
  const extra = d.data;

  const book = await getBook(bookId);
  if (!book) return fail("Unknown book.");

  // Extra reading columns for this status: where/why you stopped, or the rating you gave.
  const readingExtras =
    s.data === "abandoned" && extra
      ? { ...progressToRow(extra.progress), stop_reason: extra.reason?.trim() || null }
      : s.data === "finished" && extra
        ? { rating: extra.rating ?? null }
        : {};
  const endDate = (s.data === "finished" && extra?.finishedAt) || today;
  const startDate = s.data === "finished" && extra?.startedAt ? extra.startedAt : undefined;

  const supabase = await createClient();
  const change = planStatusChange(book.readings, s.data, endDate);
  if (change.update) {
    const { error } = await supabase
      .from("readings")
      .update({
        finished_at: change.update.finishedAt,
        outcome: change.update.outcome,
        ...(startDate ? { started_at: startDate } : {}),
        ...readingExtras,
      })
      .eq("id", change.update.id);
    if (error) return fail(dbError(error));
  }
  if (change.insert) {
    const { error } = await supabase.from("readings").insert({
      book_id: bookId,
      user_id: user.id,
      started_at: startDate ?? change.insert.startedAt,
      finished_at: change.insert.finishedAt,
      outcome: change.insert.outcome,
      ...readingExtras,
    });
    if (error) return fail(dbError(error));
  }
  // Starting or finishing a book takes it out of the "Up next" queue.
  const leaves = LEAVES_QUEUE.has(s.data) && book.queuePosition !== undefined;
  const { error } = await supabase
    .from("books")
    .update(leaves ? { status: s.data, queue_position: null } : { status: s.data })
    .eq("id", bookId);
  if (error) return fail(dbError(error));
  if (s.data === "finished" && extra?.rating) await syncBookRating(supabase, bookId);

  refreshAll();
  return ok(undefined);
}

/** Rating the book from its page also rates your most recent finished reading. */
export async function setRating(bookId: string, rating: number | null): Promise<ActionResult> {
  await requireUser();
  const r = z.number().min(0.5).max(5).multipleOf(0.5).nullable().safeParse(rating);
  if (!id.safeParse(bookId).success || !r.success) return fail("Invalid rating.");
  const supabase = await createClient();
  const { error } = await supabase.from("books").update({ rating: r.data }).eq("id", bookId);
  if (error) return fail(dbError(error));
  const book = await getBook(bookId);
  const latestFinished = book?.readings.filter((x) => x.outcome === "finished").at(-1);
  if (latestFinished) await supabase.from("readings").update({ rating: r.data }).eq("id", latestFinished.id);
  refreshAll();
  return ok(undefined);
}

export async function setFavorite(bookId: string, favorite: boolean): Promise<ActionResult> {
  await requireUser();
  if (!id.safeParse(bookId).success || typeof favorite !== "boolean") return fail("Invalid input.");
  const supabase = await createClient();
  const { error } = await supabase.from("books").update({ favorite }).eq("id", bookId);
  if (error) return fail(dbError(error));
  refreshAll();
  return ok(undefined);
}

// ───────────────────────── Readings ─────────────────────────

export async function addReading(bookId: string, raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = readingInputSchema.safeParse(raw);
  if (!id.safeParse(bookId).success || !parsed.success) return fail(parsed.error?.issues[0]?.message ?? "Invalid input.");
  const supabase = await createClient();
  const { error } = await supabase.from("readings").insert({ ...readingInputToRow(parsed.data), book_id: bookId, user_id: user.id });
  if (error) return fail(dbError(error));
  await syncBookRating(supabase, bookId);
  refreshAll();
  return ok(undefined);
}

export async function updateReading(readingId: string, raw: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = readingInputSchema.safeParse(raw);
  if (!id.safeParse(readingId).success || !parsed.success) return fail(parsed.error?.issues[0]?.message ?? "Invalid input.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("readings").update(readingInputToRow(parsed.data)).eq("id", readingId).select("book_id").single();
  if (error) return fail(dbError(error));
  await syncBookRating(supabase, data.book_id);
  refreshAll();
  return ok(undefined);
}

export async function deleteReading(readingId: string): Promise<ActionResult> {
  await requireUser();
  if (!id.safeParse(readingId).success) return fail("Invalid input.");
  const supabase = await createClient();
  const { error } = await supabase.from("readings").delete().eq("id", readingId);
  if (error) return fail(dbError(error));
  refreshAll();
  return ok(undefined);
}

// ───────────────────────── Delete / restore ─────────────────────────

/** Soft delete: the book moves to the trash and can be restored. */
export async function deleteBook(bookId: string): Promise<ActionResult> {
  await requireUser();
  if (!id.safeParse(bookId).success) return fail("Invalid input.");
  const supabase = await createClient();
  const { error } = await supabase.from("books").update({ deleted_at: new Date().toISOString() }).eq("id", bookId);
  if (error) return fail(dbError(error));
  refreshAll();
  return ok(undefined);
}

export async function restoreBook(bookId: string): Promise<ActionResult> {
  await requireUser();
  if (!id.safeParse(bookId).success) return fail("Invalid input.");
  const supabase = await createClient();
  const { error } = await supabase.from("books").update({ deleted_at: null }).eq("id", bookId);
  if (error) return fail(dbError(error));
  refreshAll();
  return ok(undefined);
}

// ───────────────────────── Covers ─────────────────────────

const COVER_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };
const MAX_COVER_BYTES = 5 * 1024 * 1024;

/** Upload your own cover photo. Each upload gets a new file name so browsers never show a stale image. */
export async function uploadCover(bookId: string, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!id.safeParse(bookId).success) return fail("Invalid input.");
  const file = formData.get("cover");
  if (!(file instanceof File) || file.size === 0) return fail("Choose an image.");
  const ext = COVER_TYPES[file.type];
  if (!ext) return fail("Use a JPG, PNG, WebP or AVIF image.");
  if (file.size > MAX_COVER_BYTES) return fail("The image is larger than 5 MB.");

  const book = await getBook(bookId);
  if (!book) return fail("Unknown book.");

  const supabase = await createClient();
  const { data: current } = await supabase.from("books").select("cover_path").eq("id", bookId).single();
  const path = `${user.id}/${bookId}-${randomUUID().slice(0, 8)}.${ext}`;
  const { error: uploadError } = await supabase.storage.from("covers").upload(path, file, { contentType: file.type });
  if (uploadError) return fail(`Couldn't upload: ${uploadError.message}`);

  const { error } = await supabase.from("books").update({ cover_path: path }).eq("id", bookId);
  if (error) return fail(dbError(error));
  if (current?.cover_path) await supabase.storage.from("covers").remove([current.cover_path]);

  refreshAll();
  return ok(undefined);
}

/** Delete forever: only for books already in the trash. Their readings go too (FK cascade), and the cover file. */
export async function purgeBook(bookId: string): Promise<ActionResult> {
  await requireUser();
  if (!id.safeParse(bookId).success) return fail("Invalid input.");
  const supabase = await createClient();
  const { data: book } = await supabase.from("books").select("cover_path, deleted_at").eq("id", bookId).single();
  if (!book?.deleted_at) return fail("Only books in the trash can be deleted forever.");
  const { error } = await supabase.from("books").delete().eq("id", bookId);
  if (error) return fail(dbError(error));
  if (book.cover_path) await supabase.storage.from("covers").remove([book.cover_path]);
  refreshAll();
  return ok(undefined);
}

// ───────────────────────── Progress & review ─────────────────────────

/**
 * Save where you are in the book. Logging progress on a book you haven't started yet starts a
 * reading today and sets the status to Reading (and takes it out of Up next).
 */
export async function updateProgress(bookId: string, rawProgress: unknown, today: string): Promise<ActionResult> {
  const user = await requireUser();
  const progress = progressSchema.safeParse(rawProgress);
  if (!id.safeParse(bookId).success || !isoDate.safeParse(today).success) return fail("Invalid input.");
  if (!progress.success) return fail(progress.error.issues[0]?.message ?? "Invalid progress.");

  const book = await getBook(bookId);
  if (!book) return fail("Unknown book.");
  const supabase = await createClient();
  const open = openReading(book.readings);

  if (open) {
    const { error } = await supabase.from("readings").update(progressToRow(progress.data)).eq("id", open.id);
    if (error) return fail(dbError(error));
  } else {
    const { error } = await supabase
      .from("readings")
      .insert({ book_id: bookId, user_id: user.id, started_at: today, outcome: null, ...progressToRow(progress.data) });
    if (error) return fail(dbError(error));
  }
  if (book.status !== "reading" && book.status !== "paused") {
    const { error } = await supabase.from("books").update({ status: "reading", queue_position: null }).eq("id", bookId);
    if (error) return fail(dbError(error));
  }
  refreshAll();
  return ok(undefined);
}

export async function setReview(bookId: string, text: string): Promise<ActionResult> {
  await requireUser();
  const review = reviewSchema.safeParse(text);
  if (!id.safeParse(bookId).success || !review.success) return fail("Invalid review.");
  const supabase = await createClient();
  const { error } = await supabase.from("books").update({ review: review.data || null }).eq("id", bookId);
  if (error) return fail(dbError(error));
  refreshAll();
  return ok(undefined);
}
