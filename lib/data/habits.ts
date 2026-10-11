import "server-only";
import { cache } from "react";
import { requireUser } from "@/lib/auth";
import type { Habit, HabitSession } from "@/lib/habits";
import { createClient } from "@/lib/supabase/server";

/** Your habits (not the ones you stopped), oldest first. */
export const getHabits = cache(async (): Promise<Habit[]> => {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("habits").select("*").is("archived_at", null).order("created_at");
  if (error) throw new Error(`Couldn't load your habits: ${error.message}`);
  return data.map((h) => ({
    id: h.id,
    name: h.name,
    sessionsPerWeek: h.sessions_per_week,
    minMinutes: h.min_minutes,
    genres: h.genres,
    bookId: h.book_id ?? undefined,
    createdAt: h.created_at,
  }));
});

/** Every session you've logged, oldest first. */
export const getHabitSessions = cache(async (): Promise<HabitSession[]> => {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("habit_sessions").select("id, habit_id, date, minutes, book_id").order("date");
  if (error) throw new Error(`Couldn't load your reading sessions: ${error.message}`);
  return data.map((s) => ({ id: s.id, habitId: s.habit_id, date: s.date, minutes: s.minutes, bookId: s.book_id ?? undefined }));
});
