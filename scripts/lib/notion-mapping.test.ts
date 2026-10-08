import { describe, expect, it } from "vitest";
import type { PageObjectResponse } from "@notionhq/client";
import { duplicateKey, mapNotionPage, splitAuthors } from "./notion-mapping";

const rt = (s: string) => [{ plain_text: s }];

/** Builds just enough of a Notion page for the mapper; the rest of the shape is irrelevant here. */
function page(props: Record<string, unknown>, extra: Record<string, unknown> = {}): PageObjectResponse {
  const base: Record<string, unknown> = {
    Title: { type: "title", title: rt("Емма") },
    Author: { type: "rich_text", rich_text: rt("Джейн Остін") },
    "Reading status": { type: "status", status: { name: "Not started" } },
    Status: { type: "select", select: { name: "Owned" } },
    Cover: { type: "files", files: [] },
  };
  return {
    id: "page-1",
    created_time: "2026-06-11T10:00:00.000Z",
    cover: null,
    properties: { ...base, ...props },
    ...extra,
  } as unknown as PageObjectResponse;
}

function mapOk(p: PageObjectResponse) {
  const r = mapNotionPage(p);
  if (!r.ok) throw new Error(r.reason);
  return r.value;
}

describe("splitAuthors", () => {
  it("splits on commas and tidies spaces", () => {
    expect(splitAuthors("Варіс Дірі,  Кетлін Міллер")).toEqual(["Варіс Дірі", "Кетлін Міллер"]);
    expect(splitAuthors("")).toEqual([]);
  });
});

describe("mapNotionPage", () => {
  it("maps the basic fields with defaults", () => {
    const { book, reading, warnings } = mapOk(page({}));
    expect(book).toMatchObject({
      notion_page_id: "page-1",
      title: "Емма",
      authors: ["Джейн Остін"],
      status: "to-read",
      owned: true,
      language: "uk",
      format: "paper",
      currency: "UAH",
      favorite: false,
    });
    expect(reading).toBeNull();
    expect(warnings).toEqual([]);
  });

  it("skips rows without a title", () => {
    expect(mapNotionPage(page({ Title: { type: "title", title: [] } }))).toEqual({ ok: false, reason: "no title" });
  });

  it.each([
    ["Finished", "finished", "finished"],
    ["Reading", "reading", null],
    ["Paused", "paused", null],
  ] as const)("maps reading status %s and creates a reading", (notion, status, outcome) => {
    const { book, reading } = mapOk(page({ "Reading status": { type: "status", status: { name: notion } } }));
    expect(book.status).toBe(status);
    expect(reading).toEqual({ outcome, started_at: null, finished_at: null });
  });

  it("warns and defaults when the reading status is empty", () => {
    const { book, warnings } = mapOk(page({ "Reading status": { type: "status", status: null } }));
    expect(book.status).toBe("to-read");
    expect(warnings).toContain("no reading status → to-read");
  });

  it("maps sold books", () => {
    const { book } = mapOk(
      page({
        Status: { type: "select", select: { name: "Sold" } },
        "Date Sold": { type: "date", date: { start: "2025-03-01" } },
        "Sale Price (UAH)": { type: "number", number: 150 },
      }),
    );
    expect(book).toMatchObject({ owned: false, sold_at: "2025-03-01", sale_price: 150 });
  });

  it("treats an empty Owned/Sold status as owned", () => {
    const { book, warnings } = mapOk(page({ Status: { type: "select", select: null } }));
    expect(book.owned).toBe(true);
    expect(warnings).toContain("no Owned/Sold status → owned");
  });

  it("turns ❤️ into a favourite", () => {
    expect(mapOk(page({ Feeling: { type: "rich_text", rich_text: rt("❤️") } })).book.favorite).toBe(true);
  });

  it("renames misspelled genres", () => {
    const { book } = mapOk(page({ Genre: { type: "select", select: { name: "Triller/Detective" } } }));
    expect(book.genres).toEqual(["Thriller/Detective"]);
  });

  it("uses Date Added as created_at, falling back to Notion's created time", () => {
    const added = mapOk(page({ "Date Added": { type: "date", date: { start: "2023-05-04" } } })).book;
    expect(added).toMatchObject({ acquired_at: "2023-05-04", created_at: "2023-05-04T12:00:00Z" });
    expect(mapOk(page({})).book.created_at).toBe("2026-06-11T10:00:00.000Z");
  });

  it("picks the cover from the Cover property", () => {
    const { cover } = mapOk(
      page({ Cover: { type: "files", files: [{ type: "external", name: "c", external: { url: "https://x/c.jpg" } }] } }),
    );
    expect(cover).toEqual({ url: "https://x/c.jpg", source: "external" });
  });
});

describe("duplicateKey", () => {
  it("ignores case", () => {
    expect(duplicateKey({ title: "Емма", authors: ["Джейн Остін"] })).toBe(
      duplicateKey({ title: "емма", authors: ["джейн остін"] }),
    );
  });
});
