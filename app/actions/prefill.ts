"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/actions/books";
import { requireUser } from "@/lib/auth";
import { getBook } from "@/lib/data/books";
import { decodeHtml, FetchError, safeFetch, sniffImageType } from "@/lib/net/safe-fetch";
import { parseBookPage, type Prefill } from "@/lib/prefill/parse";
import { createClient } from "@/lib/supabase/server";

const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" } as const;

/** Reads book details from a publisher's or shop's page. No book API involved. */
export async function prefillFromUrl(rawUrl: string): Promise<ActionResult<Prefill & { site: string }>> {
  await requireUser();
  const parsed = z.url({ protocol: /^https?$/ }).safeParse(rawUrl.trim());
  if (!parsed.success) return { ok: false, error: "Paste a full link, starting with https://" };

  try {
    const page = await safeFetch(parsed.data, { accept: "text/html,application/xhtml+xml", maxBytes: 6 * 1024 * 1024 });
    if (!/html/i.test(page.contentType)) return { ok: false, error: "That link isn't a web page." };
    const data = parseBookPage(decodeHtml(page.body, page.contentType), page.url);
    if (!data.title && !data.isbn) return { ok: false, error: "Couldn't find book details on that page. Is it the page of one book?" };
    return { ok: true, data: { ...data, site: new URL(page.url).hostname.replace(/^www\./, "") } };
  } catch (e) {
    if (e instanceof FetchError) {
      if (e.status === 403 || e.status === 429 || e.status === 503) {
        return { ok: false, error: "This site blocks automatic reading. Try the publisher's own site, or fill in by hand." };
      }
      return { ok: false, error: e.message };
    }
    return { ok: false, error: "Something went wrong reading that page." };
  }
}

/**
 * Copies a cover image from the web into our Storage, so it never disappears with the shop's page.
 * If the download fails, the link itself is kept as a fallback.
 */
export async function importCoverFromUrl(bookId: string, rawUrl: string): Promise<ActionResult> {
  const user = await requireUser();
  const url = z.url({ protocol: /^https?$/ }).safeParse(rawUrl);
  if (!z.uuid().safeParse(bookId).success || !url.success) return { ok: false, error: "Invalid input." };
  if (!(await getBook(bookId))) return { ok: false, error: "Unknown book." };

  const supabase = await createClient();
  try {
    const file = await safeFetch(url.data, { accept: "image/*", maxBytes: 5 * 1024 * 1024 });
    const type = sniffImageType(file.body);
    if (!type) throw new FetchError("That link isn't a supported image.");

    const { data: current } = await supabase.from("books").select("cover_path").eq("id", bookId).single();
    const path = `${user.id}/${bookId}-${randomUUID().slice(0, 8)}.${EXT[type]}`;
    const { error: uploadError } = await supabase.storage.from("covers").upload(path, file.body, { contentType: type });
    if (uploadError) throw new FetchError(uploadError.message);
    await supabase.from("books").update({ cover_path: path, cover_url: null }).eq("id", bookId);
    if (current?.cover_path) await supabase.storage.from("covers").remove([current.cover_path]);
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (e) {
    await supabase.from("books").update({ cover_url: url.data }).eq("id", bookId);
    revalidatePath("/", "layout");
    const reason = e instanceof Error ? e.message : "download failed";
    return { ok: false, error: `Couldn't copy the cover (${reason}); kept a link to it instead.` };
  }
}
