"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/actions/books";
import { requireUser } from "@/lib/auth";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

const id = z.uuid();
const price = z.number().min(0).max(99_999_999).nullable();

async function updateBook(bookId: string, patch: Database["public"]["Tables"]["books"]["Update"]): Promise<ActionResult> {
  await requireUser();
  if (!id.safeParse(bookId).success) return { ok: false, error: "Invalid input." };
  const supabase = await createClient();
  const { error } = await supabase.from("books").update(patch).eq("id", bookId);
  if (error) return { ok: false, error: `Couldn't save: ${error.message}` };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/** Put a book you own on the sell shelf. It stays in your library until it's sold. */
export async function putUpForSale(bookId: string): Promise<ActionResult> {
  return updateBook(bookId, { for_sale: true });
}

/** Changed your mind: off the sell shelf, still yours. */
export async function keepBook(bookId: string): Promise<ActionResult> {
  return updateBook(bookId, { for_sale: false });
}

/** Sold: the book leaves your library (and the Up next queue) and is kept in the Sold list. */
export async function markSold(bookId: string, salePrice: number | null, today: string): Promise<ActionResult> {
  if (!price.safeParse(salePrice).success || !z.iso.date().safeParse(today).success) return { ok: false, error: "Invalid price." };
  return updateBook(bookId, { for_sale: false, owned: false, sold_at: today, sale_price: salePrice, queue_position: null });
}

/** Undo a sale: back on your shelves and on the sell shelf. */
export async function undoSale(bookId: string): Promise<ActionResult> {
  return updateBook(bookId, { for_sale: true, owned: true, sold_at: null, sale_price: null });
}
