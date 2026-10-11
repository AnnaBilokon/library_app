"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/actions/books";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const id = z.uuid();
const isoDate = z.iso.date();
const habitInput = z.object({
  name: z.string().trim().min(1, "Give it a name.").max(100),
  sessionsPerWeek: z.number().int().min(1).max(7),
  minMinutes: z.number().int().min(1).max(600),
  genres: z.array(z.string().trim().min(1).max(100)).max(20),
  bookId: id.nullable(),
});
export type HabitInput = z.input<typeof habitInput>;

const refresh = () => {
  revalidatePath("/");
  revalidatePath("/habits");
};
const fail = (message: string): ActionResult => ({ ok: false, error: message });

/** Start a habit, e.g. "Non-fiction, 3 times a week, at least 15 minutes". */
export async function createHabit(input: HabitInput): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const p = habitInput.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Invalid input." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("habits")
    .insert({ user_id: user.id, name: p.data.name, sessions_per_week: p.data.sessionsPerWeek, min_minutes: p.data.minMinutes, genres: p.data.genres, book_id: p.data.bookId })
    .select("id")
    .single();
  if (error) return { ok: false, error: `Couldn't save: ${error.message}` };
  refresh();
  return { ok: true, data: { id: data.id } };
}

export async function updateHabit(habitId: string, input: HabitInput): Promise<ActionResult> {
  await requireUser();
  const p = habitInput.safeParse(input);
  if (!id.safeParse(habitId).success || !p.success) return fail(p.error?.issues[0]?.message ?? "Invalid input.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("habits")
    .update({ name: p.data.name, sessions_per_week: p.data.sessionsPerWeek, min_minutes: p.data.minMinutes, genres: p.data.genres, book_id: p.data.bookId })
    .eq("id", habitId);
  if (error) return fail(`Couldn't save: ${error.message}`);
  refresh();
  return { ok: true, data: undefined };
}

/** Stop a habit (its sessions and badges are kept); or delete it with everything. */
export async function endHabit(habitId: string, how: "stop" | "delete"): Promise<ActionResult> {
  await requireUser();
  if (!id.safeParse(habitId).success) return fail("Invalid input.");
  const supabase = await createClient();
  const { error } =
    how === "delete"
      ? await supabase.from("habits").delete().eq("id", habitId)
      : await supabase.from("habits").update({ archived_at: new Date().toISOString() }).eq("id", habitId);
  if (error) return fail(`Couldn't save: ${error.message}`);
  refresh();
  return { ok: true, data: undefined };
}

/** Log reading for a habit on a day. Logging again the same day adds the minutes. */
export async function logSession(habitId: string, date: string, minutes: number, bookId: string | null): Promise<ActionResult> {
  const user = await requireUser();
  const ok = id.safeParse(habitId).success && isoDate.safeParse(date).success && Number.isInteger(minutes) && minutes >= 1 && minutes <= 1440 && (bookId === null || id.safeParse(bookId).success);
  if (!ok) return fail("Invalid input.");
  const supabase = await createClient();
  const { data: existing, error: readError } = await supabase.from("habit_sessions").select("id, minutes").eq("habit_id", habitId).eq("date", date).maybeSingle();
  if (readError) return fail(`Couldn't save: ${readError.message}`);
  const { error } = existing
    ? await supabase.from("habit_sessions").update({ minutes: Math.min(1440, existing.minutes + minutes), ...(bookId ? { book_id: bookId } : {}) }).eq("id", existing.id)
    : await supabase.from("habit_sessions").insert({ user_id: user.id, habit_id: habitId, date, minutes, book_id: bookId });
  if (error) return fail(`Couldn't save: ${error.message}`);
  refresh();
  return { ok: true, data: undefined };
}

export async function deleteSession(sessionId: string): Promise<ActionResult> {
  await requireUser();
  if (!id.safeParse(sessionId).success) return fail("Invalid input.");
  const supabase = await createClient();
  const { error } = await supabase.from("habit_sessions").delete().eq("id", sessionId);
  if (error) return fail(`Couldn't delete: ${error.message}`);
  refresh();
  return { ok: true, data: undefined };
}
