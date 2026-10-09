import "server-only";
import { cache } from "react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Your reading-challenge goals, by year (e.g. { 2026: 30, 2025: 24 }). */
export const getGoals = cache(async (): Promise<Record<number, number>> => {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("reading_goals").select("year, goal");
  if (error) throw new Error(`Couldn't load your goals: ${error.message}`);
  return Object.fromEntries(data.map((g) => [g.year, g.goal]));
});
