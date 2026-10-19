"use server";

// New releases. Admins manage the sources and run the check, which imports what's new into the
// catalog as drafts (one Server Action per step, so the page shows progress and a long check never
// hits a time limit). Everyone can hide releases they're not interested in.

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/actions/books";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { GENRE_BATCH } from "@/lib/catalog/genres";
import type { ImportResult } from "@/lib/catalog/import-one";
import { getBooks } from "@/lib/data/books";
import { getSettings } from "@/lib/data/settings";
import { collectSource, importFromSource, refreshDetails, sortEditionsIntoGenres, type CollectedRelease } from "@/lib/releases/check";
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

export type { CollectedRelease } from "@/lib/releases/check";

/** Reads a source's listing; see collectSource. */
export async function collectReleaseLinks(sourceId: string): Promise<ActionResult<CollectedRelease>> {
  if (!(await admin())) return fail("Admins only.");
  if (!id.safeParse(sourceId).success) return fail("Unknown source.");
  return collectSource(await createClient(), sourceId);
}

/** Reads a known book's page again and fills in what's missing; see refreshDetails. */
export async function refreshReleaseDetails(url: string): Promise<ActionResult<string | null>> {
  const user = await admin();
  if (!user) return fail("Admins only.");
  const parsed = z.url({ protocol: /^https?$/ }).safeParse(url);
  if (!parsed.success) return fail("Invalid input.");
  return refreshDetails(await createClient(), user, parsed.data);
}

/** Reads one found book and adds it to the catalog as a draft from this source. */
export async function importReleaseLink(sourceId: string, url: string): Promise<ActionResult<ImportResult>> {
  const user = await admin();
  if (!user) return fail("Admins only.");
  const parsed = z.url({ protocol: /^https?$/ }).safeParse(url);
  if (!id.safeParse(sourceId).success || !parsed.success) return fail("Invalid input.");
  return { ok: true, data: await importFromSource(await createClient(), user, sourceId, parsed.data) };
}

/** Sorts new releases without genres into your genres. */
export async function sortReleasesIntoGenres(editionIds: string[]): Promise<ActionResult<number>> {
  if (!(await admin())) return fail("Admins only.");
  if (!z.array(id).min(1).max(GENRE_BATCH).safeParse(editionIds).success) return fail("Invalid input.");
  if (!process.env.ANTHROPIC_API_KEY) return fail("Sorting into genres isn't set up: ANTHROPIC_API_KEY is missing.");
  const genres = [...new Set((await getBooks()).flatMap((b) => b.genres))];
  try {
    const updated = await sortEditionsIntoGenres(await createClient(), editionIds, genres);
    refresh();
    return { ok: true, data: updated };
  } catch (e) {
    if (e instanceof Anthropic.APIError) return fail(`Couldn't sort into genres (${e.status ?? "network error"}).`);
    throw e;
  }
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
