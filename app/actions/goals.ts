"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/actions/books";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Set (or, with null, remove) how many books you want to read in a year. */
export async function setYearlyGoal(year: number, goal: number | null): Promise<ActionResult> {
  const user = await requireUser();
  const y = z.number().int().min(1900).max(2200).safeParse(year);
  const g = z.number().int("Whole books only.").min(1, "At least 1 book.").max(1000).nullable().safeParse(goal);
  if (!y.success) return { ok: false, error: "Invalid year." };
  if (!g.success) return { ok: false, error: g.error.issues[0]?.message ?? "Invalid goal." };

  const supabase = await createClient();
  const { error } =
    g.data === null
      ? await supabase.from("reading_goals").delete().eq("year", y.data)
      : await supabase.from("reading_goals").upsert({ user_id: user.id, year: y.data, goal: g.data }, { onConflict: "user_id,year" });
  if (error) return { ok: false, error: `Couldn't save the goal: ${error.message}` };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
