"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/actions/books";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/data/settings";
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

/** Choose your book of the year (or null to undo it): shown on Year in Books when the Book Battle isn't decided. */
export async function setBookOfYear(year: number, bookId: string | null): Promise<ActionResult> {
  const user = await requireUser();
  if (!z.number().int().min(1900).max(2100).safeParse(year).success || (bookId !== null && !z.uuid().safeParse(bookId).success)) {
    return { ok: false, error: "Invalid input." };
  }
  const { booksOfYear } = await getSettings();
  const next = { ...booksOfYear };
  if (bookId) next[String(year)] = bookId;
  else delete next[String(year)];
  const supabase = await createClient();
  const { error } = await supabase.from("user_settings").upsert({ user_id: user.id, books_of_year: next }, { onConflict: "user_id" });
  if (error) return { ok: false, error: `Couldn't save: ${error.message}` };
  revalidatePath("/year-in-books");
  return { ok: true, data: undefined };
}

/**
 * Remember that you've seen the "challenge complete" dialog for this year's goal. No refresh:
 * the dialog already closed itself, and nothing else on the page changes.
 */
export async function markChallengeCelebrated(year: number, goal: number): Promise<ActionResult> {
  const user = await requireUser();
  if (!z.number().int().min(1900).max(2200).safeParse(year).success || !z.number().int().min(1).max(1000).safeParse(goal).success) {
    return { ok: false, error: "Invalid input." };
  }
  const { challengesCelebrated } = await getSettings();
  const supabase = await createClient();
  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: user.id, challenges_celebrated: { ...challengesCelebrated, [String(year)]: goal } }, { onConflict: "user_id" });
  if (error) return { ok: false, error: `Couldn't save: ${error.message}` };
  return { ok: true, data: undefined };
}
