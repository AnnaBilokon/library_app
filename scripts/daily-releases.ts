/**
 * The daily New releases check (run by .github/workflows/daily-releases.yml, or by hand):
 *
 *   pnpm releases:daily                    # 2 sources, at most 40 books read
 *   pnpm releases:daily --sources 3 --max-books 60
 *   pnpm releases:daily --dry-run          # which sources it would check, changes nothing
 *
 * Takes the sources checked longest ago (so they take turns), runs the same check as the page's
 * button (new books in as drafts, known ones linked and filled in), sorts the new ones into the
 * admin's genres, then picks "books you may like" for every reader, shown on their Dashboard.
 *
 * Uses SUPABASE_SECRET_KEY, which bypasses RLS: only ever as a local script or a GitHub Actions
 * secret, never in the app or on Vercel.
 */
import { createClient } from "@supabase/supabase-js";
import { rowToBook, type BookRowWithReadings } from "../lib/books/mapping";
import type { Database } from "../lib/database.types";
import { collectSource, importFromSource, refreshDetails, sortEditionsIntoGenres, type Supabase } from "../lib/releases/check";
import { makePicks } from "../lib/releases/picks";

const args = process.argv.slice(2);
const flag = (name: string, fallback: number) => {
  const i = args.indexOf(`--${name}`);
  const n = i >= 0 ? Number(args[i + 1]) : NaN;
  return Number.isInteger(n) && n > 0 ? n : fallback;
};
const dryRun = args.includes("--dry-run");
const SOURCES = flag("sources", 2);
const MAX_BOOKS = flag("max-books", 40);

const env = (name: string) => {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}`);
    process.exit(1);
  }
  return value;
};

const BOOK_SELECT =
  "*, readings(id, started_at, finished_at, outcome, created_at, progress_page, progress_percent, progress_updated_at, stop_reason, rating)";

async function main() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const db = createClient<Database>(url, env("SUPABASE_SECRET_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
  // The app's helpers expect the server client; the secret-key client has the same API.
  const supabase = db as unknown as Supabase;
  const today = new Date().toISOString().slice(0, 10);

  const { data: usersPage, error: usersError } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (usersError) throw usersError;
  const admin = usersPage.users.find((u) => u.app_metadata?.role === "admin");
  if (!admin) throw new Error("No admin user: the check runs as an admin (pnpm catalog:seed --make-admin).");
  const asAdmin = { id: admin.id, email: admin.email ?? "", isAdmin: true };

  const { data: sources, error } = await db.from("release_sources").select("*").order("last_checked_at", { ascending: true, nullsFirst: true }).limit(SOURCES);
  if (error) throw error;
  console.log(`${dryRun ? "DRY RUN — " : ""}Checking ${sources.length} of the sources (longest unchecked first): ${sources.map((s) => s.label).join(", ")}`);
  if (dryRun) return;

  // The day's allowance, shared evenly so one busy source doesn't use it all.
  const perSource = Math.ceil(MAX_BOOKS / Math.max(1, sources.length));
  const added: string[] = [];
  const described: string[] = [];
  for (const source of sources) {
    let budget = perSource;
    const collected = await collectSource(supabase, source.id);
    if (!collected.ok) {
      console.log(`  ✗ ${source.label}: ${collected.error}`);
      continue;
    }
    const { links, refresh, found, claimed } = collected.data;
    let addedHere = 0;
    let failed = 0;
    for (const link of links) {
      if (budget-- <= 0) break;
      const r = await importFromSource(supabase, asAdmin, source.id, link).catch((e: unknown) => ({ status: "failed" as const, reason: String(e) }));
      if (r.status === "added") {
        added.push(r.editionId);
        addedHere++;
      } else if (r.status === "failed") failed++;
    }
    let filled = 0;
    for (const link of refresh) {
      if (budget-- <= 0) break;
      const r = await refreshDetails(supabase, asAdmin, link).catch(() => null);
      if (r?.ok && r.data) {
        described.push(r.data);
        filled++;
      }
    }
    // Work left over: first in line tomorrow instead of waiting for its next turn.
    const unfinished = links.length + refresh.length > perSource;
    if (unfinished) await db.from("release_sources").update({ last_checked_at: null }).eq("id", source.id);
    console.log(
      `  ${source.label}: ${found} on the page · ${addedHere} new · ${claimed} linked · ${filled} filled in${failed ? ` · ${failed} couldn't be read` : ""}${
        unfinished ? " · more tomorrow (daily limit)" : ""
      }`,
    );
  }

  // Genres: the admin's own (the catalog's genres follow the person who curates it).
  const { data: adminRows } = await db.from("books").select(BOOK_SELECT).eq("user_id", admin.id).is("deleted_at", null);
  const adminBooks = (adminRows ?? []).map((r) => rowToBook(r as BookRowWithReadings, url));
  const genres = [...new Set(adminBooks.flatMap((b) => b.genres))];
  const sorted = await sortEditionsIntoGenres(supabase, [...new Set([...added, ...described])], genres);
  console.log(`Sorted ${sorted} books into genres.`);

  // Picks for every reader, from their own books.
  for (const user of usersPage.users) {
    const { data: rows } = await db.from("books").select(BOOK_SELECT).eq("user_id", user.id).is("deleted_at", null);
    const books = (rows ?? []).map((r) => rowToBook(r as BookRowWithReadings, url));
    if (books.length === 0) continue;
    const picked = await makePicks(supabase, user.id, books, today);
    console.log(`Picks for ${user.email}: ${picked}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
