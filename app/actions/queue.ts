"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/actions/books";
import { requireUser } from "@/lib/auth";
import { nextQueueOrder, type QueueChange } from "@/lib/books/queue";
import { createClient } from "@/lib/supabase/server";

const ids = z.array(z.uuid()).max(500).refine((list) => new Set(list).size === list.length, "Duplicate books in the queue.");

async function saveOrder(order: string[]): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_queue", { ids: order });
  if (error) return { ok: false, error: `Couldn't save the queue: ${error.message}` };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

async function currentOrder(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("books")
    .select("id")
    .not("queue_position", "is", null)
    .is("deleted_at", null)
    .order("queue_position");
  return (data ?? []).map((r) => r.id);
}

/** Save the order after dragging: `order` is every queued book id, first = next read. */
export async function reorderQueue(order: string[]): Promise<ActionResult> {
  await requireUser();
  const parsed = ids.safeParse(order);
  if (!parsed.success) return { ok: false, error: "Invalid queue." };
  return saveOrder(parsed.data);
}

/** Add a book to the end of the queue, pin it as the next read, or take it out. */
export async function changeQueue(bookId: string, change: QueueChange): Promise<ActionResult> {
  await requireUser();
  if (!z.uuid().safeParse(bookId).success || !["append", "pin", "remove"].includes(change)) {
    return { ok: false, error: "Invalid input." };
  }
  return saveOrder(nextQueueOrder(await currentOrder(), bookId, change));
}
