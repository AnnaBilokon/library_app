"use server";

// Shared catalog management. Every action checks the admin role here, and the database checks it
// again (RLS on editions and on covers/catalog/), so a non-admin can't change the catalog even by
// calling these endpoints directly.

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/actions/books";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { catalogCoverPath, likeEscape, sharedFields, type SharedFields } from "@/lib/catalog/editions";
import { fillMyCoversFromEdition } from "@/lib/catalog/link";
import { normalizeIsbn } from "@/lib/isbn";
import { FetchError, safeFetch, sniffImageType } from "@/lib/net/safe-fetch";
import { editionInputSchema, editionInputToRow } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";

const id = z.uuid();
const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
const fail = (error: string): ActionResult<never> => ({ ok: false, error });

const COVER_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };
const MAX_COVER_BYTES = 5 * 1024 * 1024;

/** The signed-in admin, or null for anyone else. */
async function admin(): Promise<CurrentUser | null> {
  const user = await requireUser();
  return user.isAdmin ? user : null;
}
const isAdmin = async () => (await admin()) !== null;

function refresh() {
  revalidatePath("/", "layout");
}

/**
 * Create (id null) or update an edition. With `alsoUpdateMine`, your own book linked to it gets
 * the same details, and the catalog cover if it has none (RLS limits this to your books; other
 * people's copies stay as they are).
 */
export async function saveEdition(editionId: string | null, raw: unknown, alsoUpdateMine: boolean): Promise<ActionResult<{ id: string }>> {
  const user = await admin();
  if (!user) return fail("Admins only.");
  if (editionId !== null && !id.safeParse(editionId).success) return fail("Unknown edition.");
  const parsed = editionInputSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  const row = editionInputToRow(parsed.data);

  const supabase = await createClient();
  const { data, error } = editionId
    ? await supabase.from("editions").update(row).eq("id", editionId).select("id").single()
    : await supabase.from("editions").insert(row).select("id").single();
  if (error) return fail(error.code === "23505" ? "Another edition already has this ISBN." : `Couldn't save: ${error.message}`);

  if (editionId && alsoUpdateMine) {
    const { error: copyError } = await supabase
      .from("books")
      .update(sharedFields(row as SharedFields))
      .eq("edition_id", editionId);
    if (copyError) return fail(`Saved the edition, but couldn't update your book: ${copyError.message}`);
    await fillMyCoversFromEdition(supabase, user, editionId);
  }
  refresh();
  return ok({ id: data.id });
}

/**
 * Puts an image into covers/catalog/ for this edition and removes the previous file. Your own copy
 * of the book gets it too if it has no cover yet.
 */
async function storeCover(user: CurrentUser, editionId: string, body: Blob | Uint8Array, type: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: current } = await supabase.from("editions").select("cover_path").eq("id", editionId).single();
  const path = catalogCoverPath(editionId, COVER_TYPES[type], randomUUID().slice(0, 8));
  const { error: uploadError } = await supabase.storage.from("covers").upload(path, body, { contentType: type });
  if (uploadError) return fail(`Couldn't upload: ${uploadError.message}`);
  const { error } = await supabase.from("editions").update({ cover_path: path, cover_url: null }).eq("id", editionId);
  if (error) return fail(`Couldn't save: ${error.message}`);
  if (current?.cover_path) await supabase.storage.from("covers").remove([current.cover_path]);
  await fillMyCoversFromEdition(supabase, user, editionId);
  refresh();
  return ok(undefined);
}

export async function uploadEditionCover(editionId: string, formData: FormData): Promise<ActionResult> {
  const user = await admin();
  if (!user) return fail("Admins only.");
  if (!id.safeParse(editionId).success) return fail("Unknown edition.");
  const file = formData.get("cover");
  if (!(file instanceof File) || file.size === 0) return fail("Choose an image.");
  if (!COVER_TYPES[file.type]) return fail("Use a JPG, PNG, WebP or AVIF image.");
  if (file.size > MAX_COVER_BYTES) return fail("The image is larger than 5 MB.");
  return storeCover(user, editionId, file, file.type);
}

/** Copies a cover from the web into Storage; if that fails, keeps the link itself. */
export async function importEditionCover(editionId: string, rawUrl: string): Promise<ActionResult> {
  const user = await admin();
  if (!user) return fail("Admins only.");
  const url = z.url({ protocol: /^https?$/ }).safeParse(rawUrl);
  if (!id.safeParse(editionId).success || !url.success) return fail("Invalid input.");
  try {
    const file = await safeFetch(url.data, { accept: "image/*", maxBytes: MAX_COVER_BYTES });
    const type = sniffImageType(file.body);
    if (!type) throw new FetchError("That link isn't a supported image.");
    return await storeCover(user, editionId, file.body, type);
  } catch (e) {
    const supabase = await createClient();
    await supabase.from("editions").update({ cover_url: url.data }).eq("id", editionId);
    refresh();
    return fail(`Couldn't copy the cover (${e instanceof Error ? e.message : "download failed"}); kept a link to it instead.`);
  }
}

/** Moves every book linked to `sourceId` onto `targetId` and deletes the source edition. */
export async function mergeEdition(sourceId: string, targetId: string): Promise<ActionResult> {
  if (!(await isAdmin())) return fail("Admins only.");
  if (!id.safeParse(sourceId).success || !id.safeParse(targetId).success) return fail("Unknown edition.");
  if (sourceId === targetId) return fail("Pick a different edition.");
  const supabase = await createClient();
  const { data: oldCover, error } = await supabase.rpc("merge_editions", { source: sourceId, target: targetId });
  if (error) return fail(`Couldn't merge: ${error.message}`);
  if (oldCover) await supabase.storage.from("covers").remove([oldCover]);
  refresh();
  return ok(undefined);
}

/** Deletes an edition nobody's book links to (otherwise merge it into the right one). */
export async function deleteEdition(editionId: string): Promise<ActionResult> {
  if (!(await isAdmin())) return fail("Admins only.");
  if (!id.safeParse(editionId).success) return fail("Unknown edition.");
  const supabase = await createClient();
  const { data: copies, error: countError } = await supabase.rpc("edition_copies", { edition_ids: [editionId] });
  if (countError) return fail(`Couldn't check: ${countError.message}`);
  const linked = Number(copies[0]?.copies ?? 0);
  if (linked > 0) return fail(`${linked === 1 ? "A book links" : `${linked} books link`} to this edition. Merge it into the right one instead.`);
  const { data, error } = await supabase.from("editions").delete().eq("id", editionId).select("cover_path").single();
  if (error) return fail(`Couldn't delete: ${error.message}`);
  if (data.cover_path) await supabase.storage.from("covers").remove([data.cover_path]);
  refresh();
  return ok(undefined);
}

export interface EditionOption {
  id: string;
  title: string;
  authors: string[];
  publisher: string | null;
  publishedYear: number | null;
  isbn: string | null;
}

/** A few editions matching `q` (title, author, publisher or ISBN), for the merge picker. */
export async function findEditions(q: string, exceptId: string): Promise<ActionResult<EditionOption[]>> {
  if (!(await isAdmin())) return fail("Admins only.");
  const text = z.string().trim().max(200).safeParse(q);
  if (!text.success || !text.data) return ok([]);
  const supabase = await createClient();
  const isbn = normalizeIsbn(text.data);
  let query = supabase.from("editions").select("id, title, authors, publisher, published_year, isbn").neq("id", exceptId);
  query = isbn ? query.eq("isbn", isbn) : query.ilike("search_text", `%${likeEscape(text.data.toLowerCase())}%`);
  const { data, error } = await query.order("title").limit(10);
  if (error) return fail(`Couldn't search: ${error.message}`);
  return ok(data.map((e) => ({ id: e.id, title: e.title, authors: e.authors, publisher: e.publisher, publishedYear: e.published_year, isbn: e.isbn })));
}
