import "server-only";
import { cache } from "react";
import { requireUser } from "@/lib/auth";
import { rowToEdition, type Edition } from "@/lib/catalog/editions";
import { getBooks } from "@/lib/data/books";
import { getSettings } from "@/lib/data/settings";
import { createClient } from "@/lib/supabase/server";

export type ReleaseKind = "new" | "coming";

export interface ReleaseSource {
  id: string;
  url: string;
  label: string;
  kind: ReleaseKind;
  pages: number;
  pattern?: string;
  lastCheckedAt?: string;
}

export interface Release {
  edition: Edition;
  source: Pick<ReleaseSource, "id" | "label" | "kind">;
  /** You already have a book for it: on your shelves (or read, or sold) or on your wishlist. */
  mine?: "library" | "wishlist";
  hidden: boolean;
}

/** How many found books the page shows at most (newest first). */
export const RELEASES_SHOWN = 300;

export const getReleaseSources = cache(async (): Promise<ReleaseSource[]> => {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("release_sources").select("*").order("created_at");
  if (error) throw new Error(`Couldn't load the sources: ${error.message}`);
  return data.map((s) => ({
    id: s.id,
    url: s.url,
    label: s.label,
    kind: s.kind === "coming" ? "coming" : "new",
    pages: s.pages,
    pattern: s.pattern ?? undefined,
    lastCheckedAt: s.last_checked_at ?? undefined,
  }));
});

/**
 * Books found on the sources, newest first. RLS decides what you see: admins also see drafts
 * (just imported, not reviewed yet), everyone else the approved ones.
 */
export async function getReleases(): Promise<Release[]> {
  await requireUser();
  const supabase = await createClient();
  const [sources, books, { hiddenReleases }, { data, error }] = await Promise.all([
    getReleaseSources(),
    getBooks(),
    getSettings(),
    supabase.from("editions").select("*").not("release_source_id", "is", null).order("created_at", { ascending: false }).limit(RELEASES_SHOWN),
  ]);
  if (error) throw new Error(`Couldn't load the releases: ${error.message}`);
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const mine = new Map<string, "library" | "wishlist">();
  for (const b of books) if (b.editionId) mine.set(b.editionId, b.wanted ? "wishlist" : "library");
  const hidden = new Set(hiddenReleases);
  return data.flatMap((row) => {
    const source = sourceById.get(row.release_source_id!);
    if (!source) return [];
    return [
      {
        edition: rowToEdition(row, process.env.NEXT_PUBLIC_SUPABASE_URL!),
        source: { id: source.id, label: source.label, kind: source.kind },
        mine: mine.get(row.id),
        hidden: hidden.has(row.id),
      },
    ];
  });
}
