import "server-only";
import { cache } from "react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface Settings {
  /** Hide books on the sell shelf from the Library. */
  hideForSale: boolean;
  /** Read around the world: how many countries you'd like to have read (null = no goal). */
  countriesGoal: number | null;
  /** Series and authors you chose not to track on the Series page. */
  hiddenSeries: string[];
  hiddenAuthors: string[];
  /** Your mood and theme tags; tag suggestions choose from these. */
  tagList: string[];
  /** New releases you marked "Not interested" (edition ids). */
  hiddenReleases: string[];
  /** Your chosen book of the year, per year ("2026" → book id). */
  booksOfYear: Record<string, string>;
  /** Reading-challenge goals you've been congratulated on, per year ("2026" → 30). */
  challengesCelebrated: Record<string, number>;
}

/** Your settings (defaults when you haven't saved any yet). */
export const getSettings = cache(async (): Promise<Settings> => {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("user_settings").select("hide_for_sale, countries_goal, hidden_series, hidden_authors, tag_list, hidden_releases, books_of_year, challenges_celebrated").maybeSingle();
  if (error) throw new Error(`Couldn't load your settings: ${error.message}`);
  return {
    hideForSale: data?.hide_for_sale ?? false,
    countriesGoal: data?.countries_goal ?? null,
    hiddenSeries: data?.hidden_series ?? [],
    hiddenAuthors: data?.hidden_authors ?? [],
    tagList: data?.tag_list ?? [],
    hiddenReleases: data?.hidden_releases ?? [],
    booksOfYear: (data?.books_of_year as Record<string, string> | null) ?? {},
    challengesCelebrated: (data?.challenges_celebrated as Record<string, number> | null) ?? {},
  };
});
