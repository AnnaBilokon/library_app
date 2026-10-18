/**
 * Shrinks the catalog's existing covers (covers/catalog/) to what new ones get on upload: at most
 * 800 px wide, WebP (lib/catalog/shrink.ts). Your own books' covers aren't touched.
 *
 *   pnpm catalog:shrink-covers --dry-run          # sizes, files nothing uses, an estimate
 *   pnpm catalog:shrink-covers                    # shrink them
 *   pnpm catalog:shrink-covers --delete-orphans   # also remove catalog files no edition uses
 *
 * Each smaller cover is uploaded under a new name, the edition is pointed at it, then the old file
 * is removed: browsers never see a stale image, and the edition never points at a missing file.
 * Covers that wouldn't get at least 10% smaller are left as they are. Safe to re-run.
 *
 * Uses SUPABASE_SECRET_KEY, which bypasses RLS. Local use only — never in the app.
 */
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { catalogCoverPath } from "../lib/catalog/editions";
import { shrinkCover } from "../lib/catalog/shrink";
import type { Database } from "../lib/database.types";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const deleteOrphans = args.includes("--delete-orphans");

const env = (name: string) => {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name} in .env.local`);
    process.exit(1);
  }
  return value;
};

const BUCKET = "covers";
/** Storage on the free plan turns away bursts. */
const CONCURRENCY = 2;
const MB = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`;

async function pool<T>(items: T[], fn: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < items.length) await fn(items[next++]);
  }));
}

async function main() {
  const supabase = createClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const files: { name: string; size: number }[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(BUCKET).list("catalog", { limit: 1000, offset });
    if (error) throw error;
    for (const f of data) if (f.metadata?.size) files.push({ name: `catalog/${f.name}`, size: f.metadata.size });
    if (data.length < 1000) break;
  }
  const { data: editions, error } = await supabase.from("editions").select("id, cover_path").like("cover_path", "catalog/%");
  if (error) throw error;
  const editionByPath = new Map(editions.map((e) => [e.cover_path!, e.id]));
  const used = files.filter((f) => editionByPath.has(f.name));
  const orphans = files.filter((f) => !editionByPath.has(f.name));
  const total = files.reduce((n, f) => n + f.size, 0);

  console.log(dryRun ? "DRY RUN — nothing will be changed.\n" : "");
  console.log(`Catalog covers: ${files.length} files, ${MB(total)}`);
  console.log(`  used by an edition: ${used.length} (${MB(used.reduce((n, f) => n + f.size, 0))})`);
  console.log(`  used by nothing:    ${orphans.length} (${MB(orphans.reduce((n, f) => n + f.size, 0))})${deleteOrphans ? " → will be removed" : ""}`);
  if (dryRun) return;

  let before = 0;
  let after = 0;
  let shrunk = 0;
  let kept = 0;
  const failures: string[] = [];
  await pool(used, async (f) => {
    try {
      const { data: file, error: downloadError } = await supabase.storage.from(BUCKET).download(f.name);
      if (downloadError) throw downloadError;
      const original = new Uint8Array(await file.arrayBuffer());
      const small = await shrinkCover(original, file.type || "image/jpeg");
      if (small.body.length > original.length * 0.9) {
        kept++;
        before += original.length;
        after += original.length;
        return;
      }
      const editionId = editionByPath.get(f.name)!;
      const path = catalogCoverPath(editionId, "webp", randomUUID().slice(0, 8));
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, small.body, { contentType: small.type });
      if (uploadError) throw uploadError;
      const { error: updateError } = await supabase.from("editions").update({ cover_path: path }).eq("id", editionId);
      if (updateError) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw updateError;
      }
      await supabase.storage.from(BUCKET).remove([f.name]);
      shrunk++;
      before += original.length;
      after += small.body.length;
      process.stdout.write(`  shrunk ${shrunk} · kept ${kept}\r`);
    } catch (e) {
      failures.push(`${f.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  });

  let removed = 0;
  if (deleteOrphans && orphans.length) {
    for (let i = 0; i < orphans.length; i += 100) {
      const { error: removeError } = await supabase.storage.from(BUCKET).remove(orphans.slice(i, i + 100).map((f) => f.name));
      if (removeError) failures.push(`removing unused files: ${removeError.message}`);
      else removed += Math.min(100, orphans.length - i);
    }
  }

  console.log(`\n\nShrunk ${shrunk} covers, kept ${kept} that were already small: ${MB(before)} → ${MB(after)} (saved ${MB(before - after)}).`);
  if (removed) console.log(`Removed ${removed} unused files (${MB(orphans.reduce((n, f) => n + f.size, 0))}).`);
  if (failures.length) {
    console.log(`\nProblems (${failures.length}); run it again to retry:`);
    for (const f of failures) console.log(`  ✗ ${f}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
