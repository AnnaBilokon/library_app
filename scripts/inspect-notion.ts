/**
 * Prints the schema of the Notion books database so we can design the
 * Notion → Supabase mapping. Read-only: it never writes to Notion.
 *
 *   pnpm notion:inspect
 *
 * Needs NOTION_TOKEN and NOTION_DATABASE_ID in .env.local.
 */
import { Client, isFullPage, iteratePaginatedAPI } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client";

type PropertyValue = PageObjectResponse["properties"][string];

const SAMPLE_ROWS = 3;
const MAX_LEN = 100;

const token = process.env.NOTION_TOKEN;
const databaseId = process.env.NOTION_DATABASE_ID;
if (!token || !databaseId) {
  console.error("Missing NOTION_TOKEN or NOTION_DATABASE_ID in .env.local");
  process.exit(1);
}

const notion = new Client({ auth: token });

const clip = (s: string) => (s.length > MAX_LEN ? `${s.slice(0, MAX_LEN)}…` : s);

/** Turns any Notion property value into a short, readable string. */
function show(value: PropertyValue): string {
  switch (value.type) {
    case "title":
      return clip(value.title.map((t) => t.plain_text).join(""));
    case "rich_text":
      return clip(value.rich_text.map((t) => t.plain_text).join(""));
    case "number":
      return String(value.number ?? "");
    case "select":
      return value.select?.name ?? "";
    case "status":
      return value.status?.name ?? "";
    case "multi_select":
      return value.multi_select.map((o) => o.name).join(", ");
    case "date":
      return value.date ? [value.date.start, value.date.end].filter(Boolean).join(" → ") : "";
    case "checkbox":
      return String(value.checkbox);
    case "url":
      return clip(value.url ?? "");
    case "email":
      return value.email ?? "";
    case "phone_number":
      return value.phone_number ?? "";
    case "files":
      return value.files
        .map((f) => `${f.name} [${f.type === "file" ? "uploaded to Notion" : "external link"}]`)
        .join(", ");
    case "people":
      return value.people.map((p) => ("name" in p ? p.name : p.id)).join(", ");
    case "relation":
      return `${value.relation.length} linked page(s)`;
    case "formula": {
      const f = value.formula;
      if (f.type === "string") return clip(f.string ?? "");
      if (f.type === "number") return String(f.number ?? "");
      if (f.type === "boolean") return String(f.boolean ?? "");
      if (f.type === "date") return f.date?.start ?? "";
      return "";
    }
    case "rollup":
      return `rollup(${value.rollup.type})`;
    case "created_time":
      return value.created_time;
    case "last_edited_time":
      return value.last_edited_time;
    case "unique_id":
      return `${value.unique_id.prefix ?? ""}${value.unique_id.number ?? ""}`;
    default:
      return `(${value.type})`;
  }
}

function isEmpty(value: PropertyValue): boolean {
  const s = show(value);
  return s === "" || s === "false" || s.startsWith("0 linked");
}

function coverInfo(page: PageObjectResponse): string {
  if (!page.cover) return "none";
  return page.cover.type === "file" ? "uploaded to Notion" : `external: ${clip(page.cover.external.url)}`;
}

async function main() {
  const db = await notion.databases.retrieve({ database_id: databaseId! });
  const title = "title" in db ? db.title.map((t) => t.plain_text).join("") : "(untitled)";
  const sources = "data_sources" in db ? db.data_sources : [];
  console.log(`\n=== Database: ${title} ===`);
  console.log(`Data sources: ${sources.map((s) => `${s.name} (${s.id})`).join(", ") || "none"}`);

  for (const source of sources) {
    const ds = await notion.dataSources.retrieve({ data_source_id: source.id });
    const props = "properties" in ds ? Object.values(ds.properties) : [];

    // Read every row once so we can report how often each column is filled in.
    const pages: PageObjectResponse[] = [];
    for await (const item of iteratePaginatedAPI(notion.dataSources.query, {
      data_source_id: source.id,
      page_size: 100,
    })) {
      if (isFullPage(item)) pages.push(item);
    }

    console.log(`\n--- Data source "${source.name}": ${pages.length} rows ---\n`);
    console.log("PROPERTIES (name | type | filled in | options)");
    for (const p of props) {
      const filled = pages.filter((pg) => {
        const v = pg.properties[p.name];
        return v && !isEmpty(v);
      }).length;
      let options = "";
      if (p.type === "select") options = p.select.options.map((o) => o.name).join(", ");
      if (p.type === "multi_select") options = p.multi_select.options.map((o) => o.name).join(", ");
      if (p.type === "status") options = p.status.options.map((o) => o.name).join(", ");
      console.log(`  ${p.name} | ${p.type} | ${filled}/${pages.length}${options ? ` | ${clip(options)}` : ""}`);
    }

    console.log("\nVALUE COUNTS (select / status / multi-select)");
    for (const p of props) {
      if (p.type !== "select" && p.type !== "status" && p.type !== "multi_select") continue;
      const counts = new Map<string, number>();
      for (const pg of pages) {
        const v = pg.properties[p.name];
        const names = v ? show(v).split(", ").filter(Boolean) : [];
        for (const n of names.length ? names : ["(empty)"]) counts.set(n, (counts.get(n) ?? 0) + 1);
      }
      const list = [...counts].sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n} ${c}`);
      console.log(`  ${p.name}: ${list.join(" · ")}`);
    }

    console.log("\nFILE PROPERTIES");
    for (const p of props) {
      if (p.type !== "files") continue;
      let uploaded = 0;
      let external = 0;
      for (const pg of pages) {
        const v = pg.properties[p.name];
        if (v?.type !== "files") continue;
        for (const f of v.files) {
          if (f.type === "file") uploaded++;
          else external++;
        }
      }
      console.log(`  ${p.name}: ${uploaded} uploaded to Notion, ${external} external links`);
    }

    const created = pages.map((pg) => pg.created_time.slice(0, 10)).sort();
    const byDay = new Map<string, number>();
    for (const d of created) byDay.set(d, (byDay.get(d) ?? 0) + 1);
    const busiest = [...byDay].sort((a, b) => b[1] - a[1]).slice(0, 5);
    console.log(`\nPAGE CREATED: ${created[0]} → ${created.at(-1)}; busiest days: ${busiest.map(([d, c]) => `${d} (${c})`).join(", ")}`);

    const withCover = pages.filter((pg) => pg.cover).length;
    const uploadedCover = pages.filter((pg) => pg.cover?.type === "file").length;
    console.log(`\nPAGE COVERS: ${withCover}/${pages.length} have one (${uploadedCover} uploaded to Notion)`);

    console.log(`\nSAMPLE ROWS (first ${SAMPLE_ROWS})`);
    for (const pg of pages.slice(0, SAMPLE_ROWS)) {
      console.log(`\n  • page ${pg.id}  created ${pg.created_time}  cover: ${coverInfo(pg)}`);
      for (const [name, value] of Object.entries(pg.properties)) {
        const s = show(value);
        if (s !== "") console.log(`      ${name}: ${s}`);
      }
    }
  }
}

main().catch((err: unknown) => {
  const code = typeof err === "object" && err && "code" in err ? String(err.code) : "";
  if (code === "object_not_found") {
    console.error(
      "Notion can't find that database. Check NOTION_DATABASE_ID and that the integration is added under ••• → Connections.",
    );
  } else if (code === "unauthorized") {
    console.error("Notion rejected the token. Check NOTION_TOKEN in .env.local.");
  } else {
    console.error(err);
  }
  process.exit(1);
});
