"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/actions/books";
import { requireUser } from "@/lib/auth";
import { BRACKETS, downstreamSlots, SLOT_PATTERN } from "@/lib/battle";
import { createClient } from "@/lib/supabase/server";

const input = z.object({
  year: z.number().int().min(1900).max(2200),
  bracket: z.enum(BRACKETS),
  slot: z.string().regex(SLOT_PATTERN),
  bookId: z.uuid().nullable(),
});

/**
 * Save one decision in the bracket (or clear it with null). Everything decided after it is
 * cleared, so a later round never keeps a winner chosen from different books.
 */
export async function setBattlePick(year: number, bracket: string, slot: string, bookId: string | null): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = input.safeParse({ year, bracket, slot, bookId });
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const p = parsed.data;

  const supabase = await createClient();
  const later = downstreamSlots(p.slot);
  if (later.length) {
    const { error } = await supabase.from("book_battle_picks").delete().eq("year", p.year).eq("bracket", p.bracket).in("slot", later);
    if (error) return { ok: false, error: `Couldn't save: ${error.message}` };
  }
  const { error } =
    p.bookId === null
      ? await supabase.from("book_battle_picks").delete().eq("year", p.year).eq("bracket", p.bracket).eq("slot", p.slot)
      : await supabase
          .from("book_battle_picks")
          .upsert({ user_id: user.id, year: p.year, bracket: p.bracket, slot: p.slot, book_id: p.bookId }, { onConflict: "user_id,year,bracket,slot" });
  if (error) return { ok: false, error: `Couldn't save: ${error.message}` };
  revalidatePath("/battle");
  return { ok: true, data: undefined };
}
