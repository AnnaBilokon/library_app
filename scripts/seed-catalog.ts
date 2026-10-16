/**
 * Fills the shared catalog (editions) from one user's books and links each book to its edition.
 *
 *   pnpm catalog:seed --dry-run                 # show what would happen, change nothing
 *   pnpm catalog:seed                           # create editions, link books, copy covers
 *   pnpm catalog:seed --make-admin              # also make this user an admin
 *   pnpm catalog:seed --user you@mail.com       # needed only if the project has several users
 *
 * Safe to re-run: only books without an edition are looked at, and a book whose ISBN is
 * already in the catalog is linked to that edition instead of creating a new one.
 * Copies of the same edition (same ISBN, or same title, authors and publisher) share one edition,
 * seeded from the copy with the most details. Then every edition still without a cover gets a copy
 * of a linked book's cover in covers/catalog/ (so deleting a book never takes the catalog's cover
 * with it); a re-run retries covers that failed.
 *
 * Uses SUPABASE_SECRET_KEY, which bypasses RLS. Local use only — never in the app.
 */
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { catalogCoverPath, editionKey, pickRichest, sharedFields } from "../lib/catalog/editions";
import type { Database } from "../lib/database.types";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const makeAdmin = args.includes("--make-admin");
const userFilter = args.includes("--user") ? args[args.indexOf("--user") + 1] : undefined;

const env = (name: string) => {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name} in .env.local`);
    process.exit(1);
  }
  return value;
};

const BUCKET = "covers";
const CONCURRENCY = 8;
/** Storage on the free plan turns away bursts of copies ("Too many connections"). */
const COVER_CONCURRENCY = 2;
const COVER_ATTEMPTS = 4;

type Supabase = ReturnType<typeof createClient<Database>>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Runs `fn` over `items`, a few at a time. */
async function pool<T>(items: T[], fn: (item: T) => Promise<void>, concurrency = CONCURRENCY) {
  let next = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < items.length) await fn(items[next++]);
    }),
  );
}

async function main() {
  console.log(dryRun ? "DRY RUN — nothing will be written.\n" : "");
  const supabase = createClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: usersPage, error: usersError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (usersError) throw usersError;
  const candidates = usersPage.users.filter((u) => !userFilter || u.email === userFilter || u.id === userFilter);
  if (candidates.length !== 1) {
    throw new Error(candidates.length === 0 ? `No matching user${userFilter ? ` for "${userFilter}"` : ""}.` : "Several users found — pass --user <email>.");
  }
  const user = candidates[0];
  console.log(`Catalog from the books of ${user.email} (${user.id})`);

  const { data: books, error: booksError } = await supabase
    .from("books")
    .select("*")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .is("edition_id", null);
  if (booksError) throw booksError;

  const { data: known, error: knownError } = await supabase.from("editions").select("id, isbn").not("isbn", "is", null);
  if (knownError) throw knownError;
  const byIsbn = new Map(known.map((e) => [e.isbn!, e.id]));

  const groups = new Map<string, typeof books>();
  for (const b of books) groups.set(editionKey(b), [...(groups.get(editionKey(b)) ?? []), b]);
  const all = [...groups.values()];
  const linkOnly = all.filter((g) => g[0].isbn && byIsbn.has(g[0].isbn));
  const toCreate = all.filter((g) => !linkOnly.includes(g));
  const shared = all.filter((g) => g.length > 1);
  const missingCovers = await coverSources(supabase, user.id);

  console.log(`\nBooks without an edition:  ${books.length}`);
  console.log(`Editions to create:        ${toCreate.length} (${toCreate.filter((g) => g[0].isbn).length} with an ISBN)`);
  console.log(`Link to existing editions: ${linkOnly.length}`);
  console.log(`Covers to copy:            ${toCreate.filter((g) => pickRichest(g).cover_path).length + missingCovers.size}`);
  if (shared.length) {
    console.log(`\nSeveral copies sharing one edition (${shared.length}):`);
    for (const g of shared) console.log(`  • ${g[0].title} — ${g[0].authors.join(", ")} ×${g.length}`);
  }
  if (makeAdmin) console.log(`\n${user.email} will be made an admin (sign out and in again afterwards).`);
  if (dryRun) return;

  if (makeAdmin) {
    const { error } = await supabase.auth.admin.updateUserById(user.id, { app_metadata: { ...user.app_metadata, role: "admin" } });
    if (error) throw error;
    console.log("Made admin.");
  }

  let created = 0;
  let linked = 0;
  const failures: string[] = [];

  await pool(all, async (group) => {
    try {
      const source = pickRichest(group);
      let editionId = source.isbn ? byIsbn.get(source.isbn) : undefined;
      if (!editionId) {
        const { data, error } = await supabase
          .from("editions")
          .insert({ ...sharedFields(source), cover_url: source.cover_path ? null : source.cover_url, status: "public", created_by: user.id })
          .select("id")
          .single();
        if (error) throw error;
        editionId = data.id;
        created++;
      }
      const { error: linkError } = await supabase.from("books").update({ edition_id: editionId }).in("id", group.map((b) => b.id));
      if (linkError) throw linkError;
      linked += group.length;
      process.stdout.write(`  editions: ${created} · books linked: ${linked}/${books.length}\r`);
    } catch (e) {
      failures.push(`${group[0].title}: ${e instanceof Error ? e.message : String(e)}`);
    }
  });
  if (all.length) console.log(`\nEditions: ${created} created, ${linked} books linked.`);

  const covers = await copyMissingCovers(supabase, user.id, failures);
  console.log(`\nCovers: ${covers} copied.`);

  if (failures.length) {
    console.log(`\nProblems (${failures.length}); run it again to retry:`);
    for (const f of failures) console.log(`  ✗ ${f}`);
    process.exitCode = 1;
  }
}

/** Editions without a cover file that one of this user's linked books has a cover for. */
async function coverSources(supabase: Supabase, userId: string): Promise<Map<string, { title: string; path: string }>> {
  const { data: bare, error } = await supabase.from("editions").select("id").is("cover_path", null);
  if (error) throw error;
  const ids = new Set(bare.map((e) => e.id));
  const { data: books, error: booksError } = await supabase
    .from("books")
    .select("title, edition_id, cover_path")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .not("edition_id", "is", null)
    .not("cover_path", "is", null);
  if (booksError) throw booksError;
  const sources = new Map<string, { title: string; path: string }>();
  for (const b of books) {
    if (ids.has(b.edition_id!) && !sources.has(b.edition_id!)) sources.set(b.edition_id!, { title: b.title, path: b.cover_path! });
  }
  return sources;
}

/** Copies a linked book's cover to every edition still without one, two at a time, with retries. */
async function copyMissingCovers(supabase: Supabase, userId: string, failures: string[]): Promise<number> {
  const sources = await coverSources(supabase, userId);
  let copied = 0;
  await pool(
    [...sources],
    async ([editionId, source]) => {
      const path = catalogCoverPath(editionId, source.path.split(".").pop() ?? "jpg", randomUUID().slice(0, 8));
      for (let attempt = 1; ; attempt++) {
        const { error } = await supabase.storage.from(BUCKET).copy(source.path, path);
        if (!error) break;
        if (attempt === COVER_ATTEMPTS) return void failures.push(`${source.title}: cover not copied (${error.message})`);
        await sleep(1000 * 2 ** attempt);
      }
      const { error } = await supabase.from("editions").update({ cover_path: path, cover_url: null }).eq("id", editionId);
      if (error) return void failures.push(`${source.title}: ${error.message}`);
      copied++;
      process.stdout.write(`  covers: ${copied}/${sources.size}\r`);
    },
    COVER_CONCURRENCY,
  );
  return copied;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
