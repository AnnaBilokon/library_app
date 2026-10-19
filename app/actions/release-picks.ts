"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/actions/books";
import { requireUser } from "@/lib/auth";
import { getBooks } from "@/lib/data/books";
import { makePicks } from "@/lib/releases/picks";
import { createClient } from "@/lib/supabase/server";

/** Picks "books you may like" from releases found lately (after a manual check). Returns how many. */
export async function makeReleasePicks(today: string): Promise<ActionResult<number>> {
  const user = await requireUser();
  if (!z.iso.date().safeParse(today).success) return { ok: false, error: "Invalid date." };
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: "Picks aren't set up: ANTHROPIC_API_KEY is missing." };
  try {
    const added = await makePicks(await createClient(), user.id, await getBooks(), today);
    revalidatePath("/", "layout");
    return { ok: true, data: added };
  } catch (e) {
    if (e instanceof Anthropic.APIError) return { ok: false, error: `Couldn't pick books for you (${e.status ?? "network error"}).` };
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't pick books for you." };
  }
}

/** Marks your unseen picks as seen (the Dashboard card goes away until there are new ones). */
export async function markReleasePicksSeen(): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("release_picks").update({ seen_at: new Date().toISOString() }).is("seen_at", null);
  if (error) return { ok: false, error: `Couldn't save: ${error.message}` };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
