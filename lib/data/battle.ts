import "server-only";
import { cache } from "react";
import { requireUser } from "@/lib/auth";
import type { Bracket, Picks } from "@/lib/battle";
import { createClient } from "@/lib/supabase/server";

/** Your book battle picks for a year, per bracket ({ best: { m01: bookId, … }, worst: { … } }). */
export const getBattlePicks = cache(async (year: number): Promise<Record<Bracket, Picks>> => {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("book_battle_picks").select("bracket, slot, book_id").eq("year", year);
  if (error) throw new Error(`Couldn't load your book battle: ${error.message}`);
  const picks: Record<Bracket, Picks> = { best: {}, worst: {} };
  for (const p of data) if (p.bracket === "best" || p.bracket === "worst") picks[p.bracket][p.slot] = p.book_id;
  return picks;
});
