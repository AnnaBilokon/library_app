import { describe, expect, it } from "vitest";
import { editionKey, pickRichest, possibleDuplicates, rowToEdition, sharedFields, type BookRow, type EditionRow } from "./editions";

const row = (o: Partial<BookRow>) =>
  ({
    title: "Тигролови",
    authors: ["Іван Багряний"],
    isbn: null,
    language: "uk",
    original_language: null,
    publisher: null,
    published_year: null,
    pages: null,
    series: null,
    series_index: null,
    genres: [],
    description: null,
    cover_path: null,
    cover_url: null,
    tags: ["personal"],
    review: "mine",
    ...o,
  }) as BookRow;

describe("catalog editions", () => {
  it("keys an edition by ISBN, or by title, authors and publisher", () => {
    expect(editionKey(row({ isbn: "9786170000000" }))).toBe("isbn:9786170000000");
    expect(editionKey(row({ publisher: "Фоліо" }))).toBe(editionKey(row({ title: "ТИГРОЛОВИ ", publisher: " фоліо" })));
    expect(editionKey(row({ publisher: "Фоліо" }))).not.toBe(editionKey(row({ publisher: "Віват" })));
  });

  it("shares only the details, never personal fields", () => {
    const shared = sharedFields(row({ publisher: "Фоліо", pages: 300 }));
    expect(shared).toMatchObject({ title: "Тигролови", publisher: "Фоліо", pages: 300 });
    expect(shared).not.toHaveProperty("tags");
    expect(shared).not.toHaveProperty("review");
    expect(shared).not.toHaveProperty("cover_path");
  });

  it("seeds from the copy with the most details, a cover counting double", () => {
    const bare = row({ publisher: "Фоліо", pages: 300 });
    const covered = row({ cover_path: "u/1.jpg" });
    const rich = row({ publisher: "Фоліо", pages: 300, published_year: 2020, description: "…" });
    expect(pickRichest([bare, covered])).toBe(bare);
    expect(pickRichest([bare, covered, rich])).toBe(rich);
  });

  it("finds editions that look entered twice", () => {
    const dupes = possibleDuplicates([
      { id: "a", title: "Тигролови", authors: ["Іван Багряний"] },
      { id: "b", title: "тигролови", authors: ["Іван Багряний"] },
      { id: "c", title: "Сад Гетсиманський", authors: ["Іван Багряний"] },
    ]);
    expect([...dupes].sort()).toEqual(["a", "b"]);
  });

  it("builds the cover link from Storage, or keeps the external one", () => {
    const base = { ...row({}), id: "e1", status: "public", source_url: null, created_by: null, reviewed_at: null, search_text: "", created_at: "", updated_at: "" } as EditionRow;
    expect(rowToEdition({ ...base, cover_path: "catalog/e1-ab.jpg" }, "https://x.supabase.co").coverSrc).toBe(
      "https://x.supabase.co/storage/v1/object/public/covers/catalog/e1-ab.jpg",
    );
    expect(rowToEdition({ ...base, cover_url: "https://shop/c.jpg" }, "https://x.supabase.co").coverSrc).toBe("https://shop/c.jpg");
  });
});
