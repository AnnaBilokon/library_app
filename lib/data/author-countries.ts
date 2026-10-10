import "server-only";
import { cache } from "react";
import { requireUser } from "@/lib/auth";
import type { AuthorCountries } from "@/lib/countries";
import { createClient } from "@/lib/supabase/server";

/** Where your authors are from ({ "Сергій Жадан": ["UA"], … }). */
export const getAuthorCountries = cache(async (): Promise<AuthorCountries> => {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("author_countries").select("author, countries");
  if (error) throw new Error(`Couldn't load author countries: ${error.message}`);
  return Object.fromEntries(data.map((r) => [r.author, r.countries]));
});
