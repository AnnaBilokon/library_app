import "server-only";
import { cache } from "react";
import { requireUser } from "@/lib/auth";
import { rowToEdition, type Edition } from "@/lib/catalog/editions";
import { createClient } from "@/lib/supabase/server";

export interface ReleasePick {
  id: string;
  reason: string;
  edition: Edition;
  createdAt: string;
  seen: boolean;
}

/** Picks from the last 30 days shown on New releases ("For you") and, unseen ones, on the Dashboard. */
const PICKS_DAYS = 30;

/** Your recent picks, newest first. RLS returns only yours. */
export const getReleasePicks = cache(async (): Promise<ReleasePick[]> => {
  await requireUser();
  const supabase = await createClient();
  const since = new Date(Date.now() - PICKS_DAYS * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("release_picks")
    .select("id, reason, created_at, seen_at, editions(*)")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(`Couldn't load your picks: ${error.message}`);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return data.flatMap((p) =>
    p.editions ? [{ id: p.id, reason: p.reason, edition: rowToEdition(p.editions, url), createdAt: p.created_at, seen: p.seen_at !== null }] : [],
  );
});
