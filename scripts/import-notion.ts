/**
 * One-time import of the Notion "My library" database into Supabase.
 *
 *   pnpm notion:import --dry-run              # map everything, change nothing
 *   pnpm notion:import                        # import new books + covers
 *   pnpm notion:import --update               # also overwrite books imported earlier
 *   pnpm notion:import --user you@mail.com    # needed only if the project has several users
 *
 * Safe to re-run: books are matched on notion_page_id. Without --update, books that were
 * already imported are left alone, so edits made in the app are never overwritten.
 *
 * Uses SUPABASE_SECRET_KEY, which bypasses RLS. Local use only — never in the app.
 */
import { Client, isFullPage, iteratePaginatedAPI } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import { duplicateKey, mapNotionPage, type MappedPage } from "./lib/notion-mapping";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const update = args.includes("--update");
const userArg = args[args.indexOf("--user") + 1];
const userFilter = args.includes("--user") ? userArg : undefined;

const env = (name: string) => {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name} in .env.local`);
    process.exit(1);
  }
  return value;
};

const BUCKET = "covers";
const MAX_COVER_BYTES = 5 * 1024 * 1024;
const CHUNK = 100;

const chunks = <T>(items: T[], size = CHUNK) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));

// ───────────────────────── Notion ─────────────────────────

async function fetchNotionPages(): Promise<PageObjectResponse[]> {
  const notion = new Client({ auth: env("NOTION_TOKEN") });
  const db = await notion.databases.retrieve({ database_id: env("NOTION_DATABASE_ID") });
  const sources = "data_sources" in db ? db.data_sources : [];
  if (sources.length !== 1) throw new Error(`Expected 1 data source, found ${sources.length}`);

  const pages: PageObjectResponse[] = [];
  // The SDK paginates for us; 100 rows per request keeps us far below Notion's ~3 req/s limit.
  for await (const item of iteratePaginatedAPI(notion.dataSources.query, {
    data_source_id: sources[0].id,
    page_size: 100,
  })) {
    if (isFullPage(item)) pages.push(item);
  }
  return pages;
}

// ───────────────────────── Covers ─────────────────────────

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

/** Detects the image type from its first bytes, for servers that send a wrong Content-Type. */
function sniffImageType(bytes: Uint8Array): string | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 12) === "ftypavif") return "image/avif";
  return null;
}

async function downloadCover(url: string): Promise<{ bytes: Uint8Array; type: string }> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (personal library import)", Accept: "image/*" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > MAX_COVER_BYTES) throw new Error(`too large (${Math.round(bytes.byteLength / 1024)} KB)`);
  const type = sniffImageType(bytes) ?? res.headers.get("content-type")?.split(";")[0] ?? "";
  if (!EXT[type]) throw new Error(`unsupported type "${type || "unknown"}"`);
  return { bytes, type };
}

// ───────────────────────── Main ─────────────────────────

async function main() {
  console.log(dryRun ? "DRY RUN — nothing will be written.\n" : "");
  console.log("Reading Notion…");
  const pages = await fetchNotionPages();

  const mapped: MappedPage[] = [];
  const skipped: { id: string; reason: string }[] = [];
  for (const page of pages) {
    const result = mapNotionPage(page);
    if (result.ok) mapped.push(result.value);
    else skipped.push({ id: page.id, reason: result.reason });
  }

  // Mapping summary — shown for dry runs and real runs alike.
  const count = (key: (m: MappedPage) => string) => {
    const map = new Map<string, number>();
    for (const m of mapped) map.set(key(m), (map.get(key(m)) ?? 0) + 1);
    return [...map].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(" · ");
  };
  console.log(`\nNotion rows: ${pages.length} → mappable ${mapped.length}, unmappable ${skipped.length}`);
  console.log(`Status:     ${count((m) => m.book.status ?? "to-read")}`);
  console.log(`Owned:      ${count((m) => (m.book.owned ? "owned" : m.book.sold_at ? "sold" : "not owned"))}`);
  console.log(`Genres:     ${count((m) => m.book.genres?.[0] ?? "(none)")}`);
  console.log(`Favourites: ${mapped.filter((m) => m.book.favorite).length}`);
  console.log(`Covers:     ${count((m) => m.cover?.source ?? "none")}`);
  console.log(`Readings:   ${mapped.filter((m) => m.reading).length} to create (no dates — Notion has none)`);

  const withWarnings = mapped.filter((m) => m.warnings.length);
  if (withWarnings.length) {
    console.log(`\nWarnings (${withWarnings.length} rows):`);
    for (const m of withWarnings) console.log(`  • ${m.book.title} — ${m.warnings.join("; ")}`);
  }

  const dupes = new Map<string, MappedPage[]>();
  for (const m of mapped) dupes.set(duplicateKey(m.book), [...(dupes.get(duplicateKey(m.book)) ?? []), m]);
  const dupeGroups = [...dupes.values()].filter((g) => g.length > 1);
  if (dupeGroups.length) {
    console.log(`\nPossible duplicates (imported as separate books; the app will flag them):`);
    for (const g of dupeGroups) console.log(`  • ${g[0].book.title} — ${g[0].book.authors?.join(", ")} ×${g.length}`);
  }
  for (const s of skipped) console.log(`  ✗ skipped ${s.id}: ${s.reason}`);

  if (dryRun) return;

  // ── Write to Supabase ──
  const supabase = createClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: usersPage, error: usersError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (usersError) throw usersError;
  const candidates = usersPage.users.filter((u) => !userFilter || u.email === userFilter || u.id === userFilter);
  if (candidates.length !== 1) {
    throw new Error(
      candidates.length === 0
        ? `No matching user${userFilter ? ` for "${userFilter}"` : ""}. Create your user in the Supabase dashboard first.`
        : `Several users found — pass --user <email>.`,
    );
  }
  const user = candidates[0];
  console.log(`\nImporting for ${user.email} (${user.id})`);

  const { data: existingRows, error: existingError } = await supabase
    .from("books")
    .select("id, notion_page_id, cover_path")
    .eq("user_id", user.id)
    .not("notion_page_id", "is", null);
  if (existingError) throw existingError;
  const existing = new Map(existingRows.map((r) => [r.notion_page_id!, r]));

  const toInsert = mapped.filter((m) => !existing.has(m.book.notion_page_id));
  const toUpdate = update ? mapped.filter((m) => existing.has(m.book.notion_page_id)) : [];
  const unchanged = mapped.length - toInsert.length - toUpdate.length;

  // Insert new books, or overwrite earlier imports with --update. Both go through upsert on notion_page_id.
  const bookIds = new Map<string, { id: string; cover_path: string | null }>(
    existingRows.map((r) => [r.notion_page_id!, { id: r.id, cover_path: r.cover_path }]),
  );
  for (const batch of chunks([...toInsert, ...toUpdate])) {
    const rows = batch.map((m) => ({ ...m.book, user_id: user.id }));
    const { data, error } = await supabase
      .from("books")
      .upsert(rows, { onConflict: "notion_page_id" })
      .select("id, notion_page_id, cover_path");
    if (error) throw error;
    for (const r of data) bookIds.set(r.notion_page_id!, { id: r.id, cover_path: r.cover_path });
    process.stdout.write(`  books: ${bookIds.size}/${mapped.length}\r`);
  }
  console.log("");

  // Readings: only for books that don't have one yet, so re-runs don't duplicate them.
  const { data: readingRows, error: readingsError } = await supabase
    .from("readings")
    .select("book_id")
    .eq("user_id", user.id);
  if (readingsError) throw readingsError;
  const hasReading = new Set(readingRows.map((r) => r.book_id));
  const newReadings = mapped
    .filter((m) => m.reading && !hasReading.has(bookIds.get(m.book.notion_page_id)!.id))
    .map((m) => ({ ...m.reading!, book_id: bookIds.get(m.book.notion_page_id)!.id, user_id: user.id }));
  for (const batch of chunks(newReadings)) {
    const { error } = await supabase.from("readings").insert(batch);
    if (error) throw error;
  }

  // Covers: download each one into Storage (Notion file URLs expire in ~1 hour; shop links can vanish).
  const coverJobs = mapped.filter((m) => m.cover && !bookIds.get(m.book.notion_page_id)!.cover_path);
  const coverFailures: string[] = [];
  let coversUploaded = 0;
  for (const [i, m] of coverJobs.entries()) {
    process.stdout.write(`  covers: ${i + 1}/${coverJobs.length}\r`);
    const book = bookIds.get(m.book.notion_page_id)!;
    try {
      const { bytes, type } = await downloadCover(m.cover!.url);
      const path = `${user.id}/${book.id}.${EXT[type]}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: type, upsert: true });
      if (uploadError) throw uploadError;
      const { error } = await supabase.from("books").update({ cover_path: path, cover_url: null }).eq("id", book.id);
      if (error) throw error;
      coversUploaded++;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      // Keep a working external link as a fallback; Notion's own links expire, so drop those.
      if (m.cover!.source === "external") {
        await supabase.from("books").update({ cover_url: m.cover!.url }).eq("id", book.id);
      }
      coverFailures.push(`${m.book.title}: ${reason}${m.cover!.source === "external" ? " (kept link)" : ""}`);
    }
  }
  console.log("");

  console.log("\n=== Report ===");
  console.log(`Inserted:          ${toInsert.length}`);
  console.log(`Updated:           ${toUpdate.length}`);
  console.log(`Already imported:  ${unchanged}${unchanged && !update ? " (left untouched; use --update to overwrite)" : ""}`);
  console.log(`Skipped:           ${skipped.length}${skipped.length ? ` (${skipped.map((s) => s.reason).join(", ")})` : ""}`);
  console.log(`Readings created:  ${newReadings.length}`);
  console.log(`Covers uploaded:   ${coversUploaded}/${coverJobs.length}`);
  if (coverFailures.length) {
    console.log(`Cover failures (${coverFailures.length}):`);
    for (const f of coverFailures) console.log(`  • ${f}`);
  }

  const { count: total } = await supabase
    .from("books")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .not("notion_page_id", "is", null);
  console.log(`\nBooks from Notion now in Supabase: ${total} (Notion has ${pages.length})`);
}

main().catch((err: unknown) => {
  console.error("\nImport failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
