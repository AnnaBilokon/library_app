"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/books";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Hide (or show again) the books on the sell shelf in the Library. */
export async function setHideForSale(hide: boolean): Promise<ActionResult> {
  const user = await requireUser();
  if (typeof hide !== "boolean") return { ok: false, error: "Invalid input." };
  const supabase = await createClient();
  const { error } = await supabase.from("user_settings").upsert({ user_id: user.id, hide_for_sale: hide }, { onConflict: "user_id" });
  if (error) return { ok: false, error: `Couldn't save: ${error.message}` };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/** Set (or clear, with null) how many countries you'd like to have read authors from. */
export async function setCountriesGoal(goal: number | null): Promise<ActionResult> {
  const user = await requireUser();
  if (goal !== null && (!Number.isInteger(goal) || goal < 1 || goal > 250)) return { ok: false, error: "Pick a number from 1 to 250." };
  const supabase = await createClient();
  const { error } = await supabase.from("user_settings").upsert({ user_id: user.id, countries_goal: goal }, { onConflict: "user_id" });
  if (error) return { ok: false, error: `Couldn't save: ${error.message}` };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/** Stop tracking a series or an author on the Series page, or track it again. Books aren't changed. */
export async function setTracked(kind: "series" | "author", name: string, tracked: boolean): Promise<ActionResult> {
  const user = await requireUser();
  const clean = typeof name === "string" ? name.trim() : "";
  if ((kind !== "series" && kind !== "author") || !clean || clean.length > 200 || typeof tracked !== "boolean") return { ok: false, error: "Invalid input." };
  const supabase = await createClient();
  const { data, error: readError } = await supabase.from("user_settings").select("hidden_series, hidden_authors").maybeSingle();
  if (readError) return { ok: false, error: `Couldn't save: ${readError.message}` };
  const current = (kind === "series" ? data?.hidden_series : data?.hidden_authors) ?? [];
  const next = tracked ? current.filter((n) => n !== clean) : [...new Set([...current, clean])];
  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: user.id,
      hidden_series: kind === "series" ? next : (data?.hidden_series ?? []),
      hidden_authors: kind === "author" ? next : (data?.hidden_authors ?? []),
    },
    { onConflict: "user_id" },
  );
  if (error) return { ok: false, error: `Couldn't save: ${error.message}` };
  revalidatePath("/series", "layout");
  return { ok: true, data: undefined };
}
