"use server";

// New releases. Admins manage the sources and run the check, which imports what's new into the
// catalog as drafts (one Server Action per step, so the page shows progress and a long check never
// hits a time limit). Everyone can hide releases they're not interested in.

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/actions/books";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { describePattern, parsePattern, walkListing } from "@/lib/catalog/collect";
import { GENRE_BATCH } from "@/lib/catalog/genres";
import { sortIntoGenres } from "@/lib/catalog/genres-ai";
import { importOne, type ImportResult } from "@/lib/catalog/import-one";
import { getBooks } from "@/lib/data/books";
import { getSettings } from "@/lib/data/settings";
import { decodeHtml, FetchError, safeFetch } from "@/lib/net/safe-fetch";
import { createClient } from "@/lib/supabase/server";

const fail = (error: string): ActionResult<never> => ({ ok: false, error });
const id = z.uuid();

async function admin(): Promise<CurrentUser | null> {
  const user = await requireUser();
  return user.isAdmin ? user : null;
}

function refresh() {
  revalidatePath("/releases");
  revalidatePath("/admin", "layout");
}

// ───────────────────────── Sources ─────────────────────────

const sourceSchema = z.object({
  url: z.url({ protocol: /^https?$/, error: "Paste the full address of the listing page, starting with https://" }),
  label: z.string().trim().min(1, "Give it a name.").max(100),
  kind: z.enum(["new", "coming"]),
  pages: z.number().int().min(1).max(20),
  pattern: z.string().trim().max(200).optional(),
});
export type SourceInput = z.input<typeof sourceSchema>;

/** Add a source (id null) or change one. */
export async function saveReleaseSource(sourceId: string | null, raw: SourceInput): Promise<ActionResult> {
  if (!(await admin())) return fail("Admins only.");
  if (sourceId !== null && !id.safeParse(sourceId).success) return fail("Unknown source.");
  const parsed = sourceSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  const row = { ...parsed.data, pattern: parsed.data.pattern || null };
  const supabase = await createClient();
  const { error } = sourceId ? await supabase.from("release_sources").update(row).eq("id", sourceId) : await supabase.from("release_sources").insert(row);
  if (error) return fail(error.code === "23505" ? "That page is already a source." : `Couldn't save: ${error.message}`);
  refresh();
  return { ok: true, data: undefined };
}

/** Removes a source; the books found there stay in the catalog. */
export async function deleteReleaseSource(sourceId: string): Promise<ActionResult> {
  if (!(await admin())) return fail("Admins only.");
  if (!id.safeParse(sourceId).success) return fail("Unknown source.");
  const supabase = await createClient();
  const { error } = await supabase.from("release_sources").delete().eq("id", sourceId);
  if (error) return fail(`Couldn't delete: ${error.message}`);
  refresh();
  return { ok: true, data: undefined };
}

// ───────────────────────── The check ─────────────────────────

/**
 * Reads a source's listing (up to its page limit) and returns the book links the catalog doesn't
 * have yet. Remembers the guessed book-link pattern and when the source was checked.
 */
export async function collectReleaseLinks(sourceId: string): Promise<ActionResult<{ links: string[]; found: number }>> {
  if (!(await admin())) return fail("Admins only.");
  if (!id.safeParse(sourceId).success) return fail("Unknown source.");
  const supabase = await createClient();
  const { data: source } = await supabase.from("release_sources").select("*").eq("id", sourceId).single();
  if (!source) return fail("Unknown source.");

  let walk;
  try {
    walk = await walkListing(
      source.url,
      parsePattern(source.pattern ?? ""),
      async (url) => {
        const page = await safeFetch(url, { accept: "text/html,application/xhtml+xml", maxBytes: 8 * 1024 * 1024 });
        return decodeHtml(page.body, page.contentType);
      },
      { maxPages: source.pages },
    );
  } catch (e) {
    return fail(e instanceof FetchError ? (e.status === 403 || e.status === 429 ? "The site blocks automatic reading." : e.message) : "Couldn't read the page.");
  }
  if (!walk) return fail("Couldn't tell which links are the books; set how book links start for this source.");

  const known = new Set<string>();
  for (let i = 0; i < walk.links.length; i += 100) {
    const { data } = await supabase.from("editions").select("source_url").in("source_url", walk.links.slice(i, i + 100));
    for (const e of data ?? []) if (e.source_url) known.add(e.source_url);
  }
  await supabase
    .from("release_sources")
    .update({ last_checked_at: new Date().toISOString(), ...(source.pattern ? {} : { pattern: describePattern(walk.pattern) }) })
    .eq("id", sourceId);
  return { ok: true, data: { links: walk.links.filter((l) => !known.has(l)), found: walk.links.length } };
}

/** Reads one found book and adds it to the catalog as a draft from this source. */
export async function importReleaseLink(sourceId: string, url: string): Promise<ActionResult<ImportResult>> {
  const user = await admin();
  if (!user) return fail("Admins only.");
  const parsed = z.url({ protocol: /^https?$/ }).safeParse(url);
  if (!id.safeParse(sourceId).success || !parsed.success) return fail("Invalid input.");
  const result = await importOne(await createClient(), user, { kind: "link", text: parsed.data, url: parsed.data }, { releaseSourceId: sourceId });
  return { ok: true, data: result };
}

/** Sorts new releases without genres into your genres (GENRE_BATCH at a time). */
export async function sortReleasesIntoGenres(editionIds: string[]): Promise<ActionResult<number>> {
  if (!(await admin())) return fail("Admins only.");
  if (!z.array(id).min(1).max(GENRE_BATCH).safeParse(editionIds).success) return fail("Invalid input.");
  if (!process.env.ANTHROPIC_API_KEY) return fail("Sorting into genres isn't set up: ANTHROPIC_API_KEY is missing.");
  const genres = [...new Set((await getBooks()).flatMap((b) => b.genres))];
  if (genres.length === 0) return { ok: true, data: 0 };
  const supabase = await createClient();
  const { data: rows } = await supabase.from("editions").select("id, title, authors, description, genres").in("id", editionIds);
  const books = (rows ?? []).filter((r) => r.genres.length === 0).map((r) => ({ id: r.id, title: r.title, authors: r.authors, description: r.description ?? undefined }));
  if (books.length === 0) return { ok: true, data: 0 };
  let sorted;
  try {
    sorted = await sortIntoGenres(books, genres);
  } catch (e) {
    if (e instanceof Anthropic.APIError) return fail(`Couldn't sort into genres (${e.status ?? "network error"}).`);
    throw e;
  }
  let updated = 0;
  for (const { id: editionId, genres: g } of sorted ?? []) {
    if (g.length === 0) continue;
    const { error } = await supabase.from("editions").update({ genres: g }).eq("id", editionId);
    if (!error) updated++;
  }
  refresh();
  return { ok: true, data: updated };
}

// ───────────────────────── Not interested ─────────────────────────

/** Hides a release from your New releases (or shows it again). */
export async function setReleaseHidden(editionId: string, hidden: boolean): Promise<ActionResult> {
  const user = await requireUser();
  if (!id.safeParse(editionId).success || typeof hidden !== "boolean") return fail("Invalid input.");
  const { hiddenReleases } = await getSettings();
  const next = hidden ? [...new Set([...hiddenReleases, editionId])] : hiddenReleases.filter((x) => x !== editionId);
  const supabase = await createClient();
  const { error } = await supabase.from("user_settings").upsert({ user_id: user.id, hidden_releases: next }, { onConflict: "user_id" });
  if (error) return fail(`Couldn't save: ${error.message}`);
  revalidatePath("/releases");
  return { ok: true, data: undefined };
}
