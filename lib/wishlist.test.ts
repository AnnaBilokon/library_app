import { describe, expect, it } from "vitest";
import type { Book } from "@/lib/types";
import { groupWishlist, isWishlistOnly, releaseLabel, releaseReminders, STATUS_CHOICES, statusChoice, wishGroup, wishlistCost } from "./wishlist";

const book = (o: Partial<Book>) =>
  ({ id: o.title, title: "x", wanted: true, owned: false, currency: "UAH", createdAt: "2026-01-01T00:00:00Z", ...o }) as Book;

describe("wishlist", () => {
  it("maps priority to a group", () => {
    expect(wishGroup({ priority: undefined })).toBe("inbox");
    expect(wishGroup({ priority: "high" })).toBe("most");
    expect(wishGroup({ priority: "medium" })).toBe("most");
    expect(wishGroup({ priority: "low" })).toBe("maybe");
  });

  it("groups only wanted books, newest first", () => {
    const g = groupWishlist([
      book({ title: "Old", createdAt: "2026-01-01T00:00:00Z" }),
      book({ title: "New", createdAt: "2026-05-01T00:00:00Z" }),
      book({ title: "Top", priority: "high" }),
      book({ title: "Maybe", priority: "low" }),
      book({ title: "Not wanted", wanted: false }),
    ]);
    expect(g.inbox.map((b) => b.title)).toEqual(["New", "Old"]);
    expect(g.most.map((b) => b.title)).toEqual(["Top"]);
    expect(g.maybe.map((b) => b.title)).toEqual(["Maybe"]);
  });

  it("keeps every wishlist book on the wishlist only", () => {
    expect(isWishlistOnly({ wanted: true })).toBe(true);
    expect(isWishlistOnly({ wanted: false })).toBe(false);
  });

  it("totals prices per currency", () => {
    expect(wishlistCost([book({ wishPrice: 300 }), book({ wishPrice: 250.5 }), book({}), book({ wishPrice: 20, currency: "SEK" })])).toEqual([
      { currency: "UAH", total: 550.5, priced: 2 },
      { currency: "SEK", total: 20, priced: 1 },
    ]);
  });
});

describe("status choice", () => {
  it("offers Wishlist first and shows it for wishlist books", () => {
    expect(STATUS_CHOICES[0]).toBe("wishlist");
    expect(statusChoice({ wanted: true, status: "to-read" })).toBe("wishlist");
    expect(statusChoice({ wanted: false, status: "reading" })).toBe("reading");
  });
});

describe("release reminders", () => {
  const wish = (title: string, releaseDate?: string, wanted = true) => ({ id: title, title, wanted, releaseDate }) as unknown as Book;
  const books = [
    wish("Next week", "2026-10-17"),
    wish("Tomorrow", "2026-10-11"),
    wish("Today", "2026-10-10"),
    wish("Last week", "2026-10-03"),
    wish("Long ago", "2026-06-01"),
    wish("Next year", "2027-03-01"),
    wish("No date"),
    wish("Bought already", "2026-10-12", false),
  ];

  it("lists books coming out within a month, and ones that just came out", () => {
    const r = releaseReminders(books, "2026-10-10");
    expect(r.soon.map((x) => [x.book.title, x.days])).toEqual([
      ["Tomorrow", 1],
      ["Next week", 7],
    ]);
    expect(r.out.map((x) => [x.book.title, x.days])).toEqual([
      ["Today", 0],
      ["Last week", -7],
    ]);
  });

  it("says when a book comes out", () => {
    const fmt = (iso: string) => iso;
    expect(releaseLabel("2026-10-10", "2026-10-10", fmt)).toBe("Out today");
    expect(releaseLabel("2026-10-11", "2026-10-10", fmt)).toBe("Out tomorrow");
    expect(releaseLabel("2026-10-22", "2026-10-10", fmt)).toBe("Out in 12 days");
    expect(releaseLabel("2027-03-01", "2026-10-10", fmt)).toBe("Out 2027-03-01");
    expect(releaseLabel("2026-10-03", "2026-10-10", fmt)).toBe("Out since 2026-10-03");
  });
});
