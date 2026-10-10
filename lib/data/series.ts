import "server-only";
import { cache } from "react";
import { requireUser } from "@/lib/auth";
import type { SeriesTotals } from "@/lib/series";
import { createClient } from "@/lib/supabase/server";

/** How many books each series has, where you've set it ({ "Бріджертони": 8, … }). */
export const getSeriesTotals = cache(async (): Promise<SeriesTotals> => {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("series_totals").select("series, total");
  if (error) throw new Error(`Couldn't load series totals: ${error.message}`);
  return Object.fromEntries(data.map((r) => [r.series, r.total]));
});
