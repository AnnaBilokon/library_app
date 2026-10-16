import "server-only";
import { randomUUID } from "node:crypto";
import type { CurrentUser } from "@/lib/auth";
import type { createClient } from "@/lib/supabase/server";
import { catalogCoverPath, sharedFields, type BookRow } from "./editions";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Links a newly added book to its catalog edition: the one with the same ISBN, or a new one built
 * from the book (public when an admin adds it, a draft waiting for review otherwise). Best effort:
 * adding a book never fails because of the catalog.
 */
export async function linkToCatalog(supabase: Supabase, user: CurrentUser, book: BookRow): Promise<void> {
  try {
    let editionId: string | undefined;
    if (book.isbn) {
      const { data } = await supabase.from("editions").select("id").eq("isbn", book.isbn).maybeSingle();
      editionId = data?.id;
    }
    if (!editionId) {
      const { data, error } = await supabase
        .from("editions")
        .insert({ ...sharedFields(book), cover_url: book.cover_url, status: user.isAdmin ? "public" : "draft" })
        .select("id")
        .single();
      if (error) throw error;
      editionId = data.id;
    }
    const { error } = await supabase.from("books").update({ edition_id: editionId }).eq("id", book.id);
    if (error) throw error;
  } catch (e) {
    console.error("Couldn't link the book to the catalog:", e);
  }
}

/**
 * When an admin gives their book a cover and its edition has none yet, the edition gets its own
 * copy of the file (in covers/catalog/). Best effort, admins only (Storage allows only them).
 */
export async function shareCoverWithCatalog(supabase: Supabase, user: CurrentUser, bookId: string): Promise<void> {
  if (!user.isAdmin) return;
  try {
    const { data: book } = await supabase.from("books").select("cover_path, edition_id").eq("id", bookId).single();
    if (!book?.cover_path || !book.edition_id) return;
    const { data: edition } = await supabase.from("editions").select("cover_path").eq("id", book.edition_id).single();
    if (!edition || edition.cover_path) return;
    const path = catalogCoverPath(book.edition_id, book.cover_path.split(".").pop() ?? "jpg", randomUUID().slice(0, 8));
    const { error: copyError } = await supabase.storage.from("covers").copy(book.cover_path, path);
    if (copyError) throw copyError;
    const { error } = await supabase.from("editions").update({ cover_path: path, cover_url: null }).eq("id", book.edition_id);
    if (error) throw error;
  } catch (e) {
    console.error("Couldn't share the cover with the catalog:", e);
  }
}
