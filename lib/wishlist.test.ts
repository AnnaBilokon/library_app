import { describe, expect, it } from "vitest";
import type { Book } from "@/lib/types";
import { groupWishlist, isWishlistOnly, wishGroup, wishlistCost } from "./wishlist";

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

  it("knows which books belong only on the wishlist", () => {
    expect(isWishlistOnly({ wanted: true, owned: false })).toBe(true);
    expect(isWishlistOnly({ wanted: true, owned: true })).toBe(false);
    expect(isWishlistOnly({ wanted: false, owned: false })).toBe(false);
  });

  it("totals prices per currency", () => {
    expect(wishlistCost([book({ wishPrice: 300 }), book({ wishPrice: 250.5 }), book({}), book({ wishPrice: 20, currency: "SEK" })])).toEqual([
      { currency: "UAH", total: 550.5, priced: 2 },
      { currency: "SEK", total: 20, priced: 1 },
    ]);
  });
});
