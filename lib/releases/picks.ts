import "server-only";
import { rowToEdition } from "@/lib/catalog/editions";
import type { Book } from "@/lib/types";
import type { Supabase } from "./check";
import { readerProfile, shortlist } from "./interest";
import { choosePicks } from "./interest-ai";

/** New releases found within this many days are considered for picks. */
const RECENT_DAYS = 21;

/**
 * Saves "books you may like" for one reader: releases found lately that they don't have, didn't
 * hide and weren't shown before, shortlisted against their reading, then chosen by Claude. Returns
 * how many picks were added. `supabase` must be allowed to write this reader's picks (their own
 * session, or the daily job's secret key).
 */
export async function makePicks(supabase: Supabase, userId: string, books: Book[], today: string): Promise<number> {
  const since = new Date(Date.now() - RECENT_DAYS * 86_400_000).toISOString();
  const [{ data: rows }, { data: settings }, { data: picked }] = await Promise.all([
    supabase.from("editions").select("*").not("release_source_id", "is", null).gte("created_at", since).order("created_at", { ascending: false }).limit(400),
    supabase.from("user_settings").select("hidden_releases").eq("user_id", userId).maybeSingle(),
    supabase.from("release_picks").select("edition_id").eq("user_id", userId),
  ]);
  const skip = new Set([
    ...books.flatMap((b) => (b.editionId ? [b.editionId] : [])),
    ...(settings?.hidden_releases ?? []),
    ...(picked ?? []).map((p) => p.edition_id),
  ]);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const editions = (rows ?? []).filter((r) => !skip.has(r.id)).map((r) => rowToEdition(r, url));
  const profile = readerProfile(books, today);
  const candidates = shortlist(editions, profile);
  if (candidates.length === 0) return 0;

  const picks = await choosePicks(profile, candidates);
  if (!picks?.length) return 0;
  const { error } = await supabase
    .from("release_picks")
    .upsert(
      picks.map((p) => ({ user_id: userId, edition_id: p.editionId, reason: p.reason })),
      { onConflict: "user_id,edition_id", ignoreDuplicates: true },
    );
  if (error) throw new Error(`Couldn't save the picks: ${error.message}`);
  return picks.length;
}
