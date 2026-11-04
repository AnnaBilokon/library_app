"use server";

import { z } from "zod";
import type { ActionResult } from "@/app/actions/books";
import { requireUser } from "@/lib/auth";
import { likeEscape, rowToEdition, type Edition } from "@/lib/catalog/editions";
import type { OnlineBook } from "@/lib/catalog/import";
import { searchBooksOnline } from "@/lib/catalog/online-search";
import { normalizeIsbn } from "@/lib/isbn";
import { createClient } from "@/lib/supabase/server";

/**
 * Search the shared catalog by title, author, publisher, series or ISBN. Everyone signed in sees
 * public editions and their own drafts (RLS decides).
 */
export async function findInCatalog(q: string): Promise<ActionResult<Edition[]>> {
  await requireUser();
  const text = z.string().trim().max(200).safeParse(q);
  if (!text.success || text.data.length < 2) return { ok: true, data: [] };

  const supabase = await createClient();
  const isbn = normalizeIsbn(text.data);
  const query = supabase.from("editions").select("*");
  const { data, error } = await (isbn ? query.eq("isbn", isbn) : query.ilike("search_text", `%${likeEscape(text.data.toLowerCase())}%`))
    .order("title")
    .limit(8);
  if (error) return { ok: false, error: `Couldn't search the catalog: ${error.message}` };
  return { ok: true, data: data.map((row) => rowToEdition(row, process.env.NEXT_PUBLIC_SUPABASE_URL!)) };
}

/**
 * Search outside the catalog (Google Books, Open Library) for a book nobody has added yet. A
 * result only fills in the new-book form; saving it adds it to the catalog like any other book.
 */
export async function findOnline(q: string): Promise<ActionResult<OnlineBook[]>> {
  await requireUser();
  const text = z.string().trim().max(200).safeParse(q);
  if (!text.success || text.data.length < 2) return { ok: true, data: [] };
  const found = await searchBooksOnline(text.data);
  return found ? { ok: true, data: found } : { ok: false, error: "Couldn't reach the online book search. Try again in a moment." };
}
