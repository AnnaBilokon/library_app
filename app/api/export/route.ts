import { requireUser } from "@/lib/auth";
import { getAuthorCountries } from "@/lib/data/author-countries";
import { getBooks } from "@/lib/data/books";
import { booksToCsv, exportFileName } from "@/lib/export";
import { createClient } from "@/lib/supabase/server";

/**
 * Download your library: ?format=json is the full backup (every table, raw rows, books in the
 * trash too, your settings, and the shared catalog you can see with its publisher sources),
 * ?format=csv a spreadsheet of your books. Row-level security means it can only ever contain your
 * own data plus the catalog rows you're allowed to see (admins: all of them).
 */
export async function GET(request: Request) {
  const user = await requireUser();
  const format = new URL(request.url).searchParams.get("format") === "csv" ? "csv" : "json";
  const date = new Date().toISOString().slice(0, 10);
  const headers = (type: string, ext: "csv" | "json") => ({
    "Content-Type": type,
    "Content-Disposition": `attachment; filename="${exportFileName(date, ext)}"`,
    "Cache-Control": "no-store",
  });

  if (format === "csv") {
    const [books, countries] = await Promise.all([getBooks(), getAuthorCountries()]);
    return new Response(booksToCsv(books, countries), { headers: headers("text/csv; charset=utf-8", "csv") });
  }

  const supabase = await createClient();
  const [books, authorCountries, goals, battle, settings, editions, sources] = await Promise.all([
    supabase.from("books").select("*, readings(*)").order("created_at"),
    supabase.from("author_countries").select("author, countries, updated_at").order("author"),
    supabase.from("reading_goals").select("year, goal, updated_at").order("year"),
    supabase.from("book_battle_picks").select("year, bracket, slot, book_id, updated_at").order("year"),
    supabase.from("user_settings").select("*").maybeSingle(),
    // Everything but the search index, which the database rebuilds itself.
    supabase
      .from("editions")
      .select(
        "id, title, authors, isbn, language, original_language, publisher, published_year, pages, series, series_index, genres, description, cover_path, cover_url, source_url, status, reviewed_at, release_source_id, created_by, created_at, updated_at",
      )
      .order("created_at"),
    supabase.from("release_sources").select("*").order("created_at"),
  ]);
  const failed = [books, authorCountries, goals, battle, settings, editions, sources].find((r) => r.error);
  if (failed?.error) return new Response(`Couldn't export: ${failed.error.message}`, { status: 500 });

  const backup = {
    app: "my-library",
    version: 1,
    exportedAt: new Date().toISOString(),
    account: user.email,
    counts: {
      books: books.data!.length,
      readings: books.data!.reduce((n, b) => n + (b.readings?.length ?? 0), 0),
      catalogEditions: editions.data!.length,
    },
    books: books.data,
    authorCountries: authorCountries.data,
    readingGoals: goals.data,
    battlePicks: battle.data,
    settings: settings.data,
    // The shared catalog (cover files stay in Storage; cover_path points at them).
    catalog: { editions: editions.data, releaseSources: sources.data },
  };
  return new Response(JSON.stringify(backup, null, 2), { headers: headers("application/json; charset=utf-8", "json") });
}
