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
