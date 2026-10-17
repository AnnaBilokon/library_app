"use server";

// Your tag list and tag suggestions. Tags are personal: everything here reads and writes only
// your own books and settings (RLS), and each action checks the session and its input.

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/actions/books";
import { requireUser } from "@/lib/auth";
import { getBooks } from "@/lib/data/books";
import { getSettings } from "@/lib/data/settings";
import { createClient } from "@/lib/supabase/server";
import { proposeTagList, suggestTags } from "@/lib/tags/ai";
import { cleanTagList, mergeTags, normalizeTag, renameInTags, TAG_BATCH, type TagSuggestion } from "@/lib/tags/tags";

const fail = (error: string): ActionResult<never> => ({ ok: false, error });

function aiError(e: unknown): ActionResult<never> {
  if (e instanceof Anthropic.AuthenticationError) return fail("Suggestions aren't set up: the ANTHROPIC_API_KEY isn't valid.");
  if (e instanceof Anthropic.RateLimitError) return fail("Too many requests just now. Try again in a minute.");
  if (e instanceof Anthropic.APIError) return fail(`Couldn't get suggestions (${e.status ?? "network error"}). Try again?`);
  throw e;
}

const noKey = () => (process.env.ANTHROPIC_API_KEY ? null : fail("Suggestions aren't set up: ANTHROPIC_API_KEY is missing."));

export async function saveTagList(tags: string[]): Promise<ActionResult<string[]>> {
  const user = await requireUser();
  const parsed = z.array(z.string().max(100)).max(200).safeParse(tags);
  if (!parsed.success) return fail("Invalid tag list.");
  const list = cleanTagList(parsed.data);
  const supabase = await createClient();
  const { error } = await supabase.from("user_settings").upsert({ user_id: user.id, tag_list: list }, { onConflict: "user_id" });
  if (error) return fail(`Couldn't save: ${error.message}`);
  revalidatePath("/", "layout");
  return { ok: true, data: list };
}

/** Claude proposes a starting list from your library; nothing is saved until you save the list. */
export async function suggestTagList(): Promise<ActionResult<string[]>> {
  await requireUser();
  const missing = noKey();
  if (missing) return missing;
  const books = await getBooks();
  const genres = [...new Set(books.flatMap((b) => b.genres))];
  try {
    const list = await proposeTagList(books, genres);
    return list ? { ok: true, data: list } : fail("Couldn't come up with a list. Try again?");
  } catch (e) {
    return aiError(e);
  }
}

/** Tag suggestions for up to TAG_BATCH of your books, from your tag list. Nothing is saved. */
export async function suggestTagsForBooks(bookIds: string[]): Promise<ActionResult<TagSuggestion[]>> {
  await requireUser();
  const missing = noKey();
  if (missing) return missing;
  if (!z.array(z.uuid()).min(1).max(TAG_BATCH).safeParse(bookIds).success) return fail("Invalid input.");
  const [all, { tagList }] = await Promise.all([getBooks(), getSettings()]);
  if (tagList.length === 0) return fail("Set up your tag list first.");
  const wanted = new Set(bookIds);
  const books = all.filter((b) => wanted.has(b.id));
  try {
    const suggestions = await suggestTags(books, tagList);
    return suggestions ? { ok: true, data: suggestions } : fail("Couldn't suggest tags for these. Try again?");
  } catch (e) {
    return aiError(e);
  }
}

const draftSchema = z.object({
  title: z.string().trim().min(1).max(500),
  authors: z.array(z.string().max(200)).max(20),
  genres: z.array(z.string().max(100)).max(20),
  description: z.string().max(20_000).optional(),
  tags: z.array(z.string().max(100)).max(30),
});

/** Tag suggestions for the book in the form you're filling in (saved or not). */
export async function suggestTagsForDraft(raw: unknown): Promise<ActionResult<string[]>> {
  await requireUser();
  const missing = noKey();
  if (missing) return missing;
  const parsed = draftSchema.safeParse(raw);
  if (!parsed.success) return fail("Add a title first.");
  const { tagList } = await getSettings();
  if (tagList.length === 0) return fail("Set up your tag list first (Tags page).");
  try {
    const suggestions = await suggestTags([{ id: "draft", ...parsed.data }], tagList);
    return suggestions ? { ok: true, data: suggestions[0]?.tags ?? [] } : fail("Couldn't suggest tags. Try again?");
  } catch (e) {
    return aiError(e);
  }
}

/** Adds the chosen tags to your books (keeping the tags they have). */
export async function applyTagSuggestions(items: TagSuggestion[]): Promise<ActionResult<number>> {
  await requireUser();
  const parsed = z
    .array(z.object({ bookId: z.uuid(), tags: z.array(z.string().max(100)).max(10) }))
    .max(1000)
    .safeParse(items);
  if (!parsed.success) return fail("Invalid input.");
  const books = new Map((await getBooks()).map((b) => [b.id, b]));
  const supabase = await createClient();
  let updated = 0;
  for (const { bookId, tags } of parsed.data) {
    const book = books.get(bookId);
    if (!book || tags.length === 0) continue;
    const next = mergeTags(book.tags, tags.map(normalizeTag));
    if (next.length === book.tags.length) continue;
    const { error } = await supabase.from("books").update({ tags: next }).eq("id", bookId);
    if (error) return fail(`Saved ${updated}, then couldn't save more: ${error.message}`);
    updated++;
  }
  revalidatePath("/", "layout");
  return { ok: true, data: updated };
}

/** Renames a tag on all your books and in your list (merging into `to` when it exists already). */
export async function renameTag(from: string, to: string): Promise<ActionResult<number>> {
  const user = await requireUser();
  const target = normalizeTag(z.string().max(100).catch("").parse(to));
  if (!target) return fail("Type the new name.");
  const source = normalizeTag(z.string().max(100).catch("").parse(from));
  const [books, { tagList }] = await Promise.all([getBooks(), getSettings()]);
  const supabase = await createClient();
  let updated = 0;
  for (const book of books) {
    if (!book.tags.some((t) => normalizeTag(t) === source)) continue;
    const { error } = await supabase.from("books").update({ tags: renameInTags(book.tags, from, target) }).eq("id", book.id);
    if (error) return fail(`Renamed it on ${updated} books, then failed: ${error.message}`);
    updated++;
  }
  const list = cleanTagList(tagList.map((t) => (normalizeTag(t) === source ? target : t)));
  await supabase.from("user_settings").upsert({ user_id: user.id, tag_list: list }, { onConflict: "user_id" });
  revalidatePath("/", "layout");
  return { ok: true, data: updated };
}
