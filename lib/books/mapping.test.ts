import { describe, expect, it } from "vitest";
import { coverPublicUrl, rowToBook, type BookRowWithReadings } from "./mapping";

const URL = "https://abc.supabase.co";

function row(overrides: Partial<BookRowWithReadings> = {}): BookRowWithReadings {
  return {
    id: "b1",
    user_id: "u1",
    title: "Емма",
    authors: ["Джейн Остін"],
    status: "finished",
    favorite: false,
    for_sale: false,
    rating: null,
    cover_path: null,
    cover_url: null,
    isbn: null,
    genres: ["Classic"],
    tags: [],
    language: "uk",
    original_language: null,
    format: "paper",
    publisher: null,
    published_year: 2020,
    pages: null,
    series: null,
    series_index: null,
    notes: null,
    review: null,
    description: null,
    owned: true,
    acquired_at: null,
    purchase_price: null,
    sold_at: null,
    sale_price: null,
    sale_original_price: null,
    sale_original_currency: null,
    currency: "UAH",
    wanted: false,
    priority: null,
    wish_price: null,
    where_to_buy: null,
    wishlist_reason: null,
    notion_page_id: null,
    queue_position: null,
    deleted_at: null,
    created_at: "2026-06-11T10:00:00Z",
    updated_at: "2026-06-11T10:00:00Z",
    readings: [],
    ...overrides,
  };
}

describe("rowToBook", () => {
  it("maps snake_case to camelCase and drops nulls", () => {
    const book = rowToBook(row(), URL);
    expect(book).toMatchObject({ id: "b1", title: "Емма", publishedYear: 2020, owned: true, language: "uk" });
    expect(book).not.toHaveProperty("rating", null);
    expect(book.rating).toBeUndefined();
    expect(book.coverSrc).toBeUndefined();
  });

  it("prefers the Storage cover over the external link", () => {
    expect(rowToBook(row({ cover_path: "u1/b1.jpg", cover_url: "https://x/y.jpg" }), URL).coverSrc).toBe(
      `${URL}/storage/v1/object/public/covers/u1/b1.jpg`,
    );
    expect(rowToBook(row({ cover_url: "https://x/y.jpg" }), URL).coverSrc).toBe("https://x/y.jpg");
  });

  it("derives reading facts", () => {
    const book = rowToBook(
      row({
        readings: [
          { id: "r2", started_at: "2025-01-01", finished_at: "2025-02-01", outcome: "finished", created_at: "2026-01-01", progress_page: null, progress_percent: null, progress_updated_at: null, stop_reason: null, rating: null },
          { id: "r1", started_at: "2023-01-01", finished_at: "2023-03-01", outcome: "finished", created_at: "2026-01-02", progress_page: null, progress_percent: null, progress_updated_at: null, stop_reason: null, rating: null },
          { id: "r3", started_at: null, finished_at: null, outcome: "finished", created_at: "2026-01-03", progress_page: null, progress_percent: null, progress_updated_at: null, stop_reason: null, rating: null },
        ],
      }),
      URL,
    );
    expect(book.readings.map((r) => r.id)).toEqual(["r1", "r2", "r3"]);
    expect(book.lastFinishedAt).toBe("2025-02-01");
    expect(book.timesRead).toBe(3);
  });
});

describe("coverPublicUrl", () => {
  it("encodes each path segment", () => {
    expect(coverPublicUrl(URL, "u1/a b.jpg")).toBe(`${URL}/storage/v1/object/public/covers/u1/a%20b.jpg`);
  });
});
