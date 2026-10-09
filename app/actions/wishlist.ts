"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/actions/books";
import { requireUser } from "@/lib/auth";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { GROUP_PRIORITY, type WishGroup } from "@/lib/wishlist";

const id = z.uuid();

async function updateBook(bookId: string, patch: Database["public"]["Tables"]["books"]["Update"]): Promise<ActionResult> {
  await requireUser();
  if (!id.safeParse(bookId).success) return { ok: false, error: "Invalid input." };
  const supabase = await createClient();
  const { error } = await supabase.from("books").update(patch).eq("id", bookId);
  if (error) return { ok: false, error: `Couldn't save: ${error.message}` };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/** Move a wishlist book between "Just added", "Most wanted" and "Heard it's good". */
export async function moveWishlistBook(bookId: string, group: WishGroup): Promise<ActionResult> {
  if (!["inbox", "most", "maybe"].includes(group)) return { ok: false, error: "Invalid group." };
  return updateBook(bookId, { priority: GROUP_PRIORITY[group] });
}

export async function addToWishlist(bookId: string): Promise<ActionResult> {
  return updateBook(bookId, { wanted: true });
}

export async function removeFromWishlist(bookId: string): Promise<ActionResult> {
  return updateBook(bookId, { wanted: false, priority: null });
}

/** "Bought it!": the book moves onto your shelves, added today, and off the wishlist. */
export async function markBought(bookId: string, today: string): Promise<ActionResult> {
  if (!z.iso.date().safeParse(today).success) return { ok: false, error: "Invalid date." };
  return updateBook(bookId, { wanted: false, priority: null, owned: true, acquired_at: today });
}
