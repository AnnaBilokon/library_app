import "server-only";
import { cache } from "react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface Settings {
  /** Hide books on the sell shelf from the Library. */
  hideForSale: boolean;
  /** Read around the world: how many countries you'd like to have read (null = no goal). */
  countriesGoal: number | null;
}

/** Your settings (defaults when you haven't saved any yet). */
export const getSettings = cache(async (): Promise<Settings> => {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("user_settings").select("hide_for_sale, countries_goal").maybeSingle();
  if (error) throw new Error(`Couldn't load your settings: ${error.message}`);
  return { hideForSale: data?.hide_for_sale ?? false, countriesGoal: data?.countries_goal ?? null };
});
