import "server-only";
import { cache } from "react";
import { requireUser } from "@/lib/auth";
import { rowToBook } from "@/lib/books/mapping";
import { createClient } from "@/lib/supabase/server";
import type { Book } from "@/lib/types";

const SELECT = "*, readings(id, started_at, finished_at, outcome, created_at)";

/**
 * All of the user's books (not in the trash). A personal library is small enough
 * to load once per request and filter/sort in the browser.
 */
export const getBooks = cache(async (): Promise<Book[]> => {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("books")
    .select(SELECT)
    .is("deleted_at", null)
    .order("title");
  if (error) throw new Error(`Couldn't load books: ${error.message}`);
  return data.map((row) => rowToBook(row, process.env.NEXT_PUBLIC_SUPABASE_URL!));
});

/** One book, or null if it doesn't exist (or belongs to someone else: RLS hides it). */
export const getBook = cache(async (id: string): Promise<Book | null> => {
  await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("books")
    .select(SELECT)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load the book: ${error.message}`);
  return data ? rowToBook(data, process.env.NEXT_PUBLIC_SUPABASE_URL!) : null;
});
