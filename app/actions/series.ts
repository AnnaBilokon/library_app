"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/actions/books";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const input = z.object({
  series: z.string().trim().min(1).max(200),
  total: z.number().int().min(1).max(200).nullable(),
});

/** Set how many books a series has; null removes it. */
export async function setSeriesTotal(series: string, total: number | null): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = input.safeParse({ series, total });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const p = parsed.data;

  const supabase = await createClient();
  const { error } =
    p.total === null
      ? await supabase.from("series_totals").delete().eq("series", p.series)
      : await supabase.from("series_totals").upsert({ user_id: user.id, series: p.series, total: p.total }, { onConflict: "user_id,series" });
  if (error) return { ok: false, error: `Couldn't save: ${error.message}` };
  revalidatePath("/series");
  return { ok: true, data: undefined };
}
