import "server-only";
import { randomUUID } from "node:crypto";
import type { ActionResult } from "@/app/actions/books";
import type { CurrentUser } from "@/lib/auth";
import { FetchError, safeFetch, sniffImageType } from "@/lib/net/safe-fetch";
import type { createClient } from "@/lib/supabase/server";
import { catalogCoverPath } from "./editions";
import { fillMyCoversFromEdition } from "./link";
import { shrinkCover } from "./shrink";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const COVER_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };
export const MAX_COVER_BYTES = 5 * 1024 * 1024;

/**
 * Puts an image into covers/catalog/ for this edition, shrunk to at most COVER_WIDTH (see
 * shrinkCover), and removes the previous file. The admin's own copy of the book gets it too if it
 * has no cover yet. Admins only (Storage and RLS check).
 */
export async function storeEditionCover(
  supabase: Supabase,
  user: CurrentUser,
  editionId: string,
  body: Blob | Uint8Array,
  type: string,
): Promise<ActionResult> {
  const { data: current } = await supabase.from("editions").select("cover_path").eq("id", editionId).single();
  const original = body instanceof Uint8Array ? body : new Uint8Array(await body.arrayBuffer());
  const small = await shrinkCover(original, type);
  const path = catalogCoverPath(editionId, COVER_TYPES[small.type] ?? COVER_TYPES[type], randomUUID().slice(0, 8));
  const { error: uploadError } = await supabase.storage.from("covers").upload(path, small.body, { contentType: small.type });
  if (uploadError) return { ok: false, error: `Couldn't upload: ${uploadError.message}` };
  const { error } = await supabase.from("editions").update({ cover_path: path, cover_url: null }).eq("id", editionId);
  if (error) return { ok: false, error: `Couldn't save: ${error.message}` };
  if (current?.cover_path) await supabase.storage.from("covers").remove([current.cover_path]);
  await fillMyCoversFromEdition(supabase, user, editionId);
  return { ok: true, data: undefined };
}

/** Copies a cover from the web into the catalog; if that fails, keeps the link itself. */
export async function importEditionCoverFromUrl(supabase: Supabase, user: CurrentUser, editionId: string, url: string): Promise<ActionResult> {
  try {
    const file = await safeFetch(url, { accept: "image/*", maxBytes: MAX_COVER_BYTES });
    const type = sniffImageType(file.body);
    if (!type) throw new FetchError("That link isn't a supported image.");
    return await storeEditionCover(supabase, user, editionId, file.body, type);
  } catch (e) {
    await supabase.from("editions").update({ cover_url: url }).eq("id", editionId);
    return { ok: false, error: `Couldn't copy the cover (${e instanceof Error ? e.message : "download failed"}); kept a link to it instead.` };
  }
}
