"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/actions/books";
import { requireUser } from "@/lib/auth";
import { isCountryCode, MAX_AUTHOR_COUNTRIES } from "@/lib/countries";
import { createClient } from "@/lib/supabase/server";

const input = z.object({
  author: z.string().trim().min(1).max(200),
  countries: z.array(z.string().refine(isCountryCode, "Unknown country.")).max(MAX_AUTHOR_COUNTRIES),
});

/** Set where an author is from (one or two countries); an empty list removes it. */
export async function setAuthorCountries(author: string, countries: string[]): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = input.safeParse({ author, countries: [...new Set(countries)] });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const p = parsed.data;

  const supabase = await createClient();
  const { error } =
    p.countries.length === 0
      ? await supabase.from("author_countries").delete().eq("author", p.author)
      : await supabase.from("author_countries").upsert({ user_id: user.id, author: p.author, countries: p.countries }, { onConflict: "user_id,author" });
  if (error) return { ok: false, error: `Couldn't save: ${error.message}` };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
