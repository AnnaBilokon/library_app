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
  // Wishlist books aren't on your shelves (and not in the Up next queue, which is for your own books).
  return updateBook(bookId, { wanted: true, owned: false, queue_position: null });
}

export async function removeFromWishlist(bookId: string): Promise<ActionResult> {
  return updateBook(bookId, { wanted: false, priority: null, ordered_at: null });
}

/** You've ordered a wishlist book (it waits in "Ordered" until it arrives), or you haven't after all. */
export async function setOrdered(bookId: string, ordered: boolean, today: string): Promise<ActionResult> {
  if (!z.iso.date().safeParse(today).success || typeof ordered !== "boolean") return { ok: false, error: "Invalid input." };
  return updateBook(bookId, { ordered_at: ordered ? today : null });
}

/**
 * "Bought it!": the book moves onto your shelves, added today, and off the wishlist. What you paid
 * (optional) is kept next to the expected price, so Stats can show what you saved.
 */
export async function markBought(bookId: string, today: string, paid: number | null = null): Promise<ActionResult> {
  if (!z.iso.date().safeParse(today).success) return { ok: false, error: "Invalid date." };
  if (paid !== null && !z.number().min(0).max(1_000_000).safeParse(paid).success) return { ok: false, error: "Invalid price." };
  return updateBook(bookId, { wanted: false, priority: null, owned: true, acquired_at: today, ordered_at: null, ...(paid !== null ? { purchase_price: Math.round(paid * 100) / 100 } : {}) });
}

/** What you paid for a book you've ordered (or null to clear it); kept when it arrives. */
export async function setPricePaid(bookId: string, price: number | null): Promise<ActionResult> {
  if (price !== null && !z.number().min(0).max(1_000_000).safeParse(price).success) return { ok: false, error: "Invalid price." };
  return updateBook(bookId, { purchase_price: price === null ? null : Math.round(price * 100) / 100 });
}
