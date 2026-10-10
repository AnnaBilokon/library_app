import { describe, expect, it } from "vitest";
import type { Book } from "@/lib/types";
import { canSell, inLibrary, isSold, receivedTotal, salePriceLabel, soldTotal, splitSelling } from "./selling";

const book = (o: Partial<Book>) =>
  ({ id: o.title, title: "x", owned: true, wanted: false, forSale: false, currency: "UAH", format: "paper", updatedAt: "2026-01-01T00:00:00Z", ...o }) as Book;

describe("selling", () => {
  it("keeps sold and wishlist books out of the library", () => {
    expect(inLibrary(book({}))).toBe(true);
    expect(inLibrary(book({ forSale: true }))).toBe(true);
    expect(inLibrary(book({ soldAt: "2026-10-01", owned: false }))).toBe(false);
    expect(inLibrary(book({ wanted: true, owned: false }))).toBe(false);
    expect(isSold(book({ soldAt: "2026-10-01" }))).toBe(true);
  });

  it("only offers selling for paper books you own", () => {
    expect(canSell(book({}))).toBe(true);
    expect(canSell(book({ format: undefined }))).toBe(true);
    expect(canSell(book({ format: "ebook" }))).toBe(false);
    expect(canSell(book({ format: "audio" }))).toBe(false);
    expect(canSell(book({ owned: false }))).toBe(false);
    expect(canSell(book({ forSale: true }))).toBe(false);
    expect(canSell(book({ soldAt: "2026-10-01" }))).toBe(false);
  });

  it("splits the shelf into to sell (newest first) and sold (latest sale first)", () => {
    const { toSell, sold } = splitSelling([
      book({ title: "Old", forSale: true, updatedAt: "2026-01-01T00:00:00Z" }),
      book({ title: "New", forSale: true, updatedAt: "2026-05-01T00:00:00Z" }),
      book({ title: "Kept" }),
      book({ title: "Sold in May", soldAt: "2026-05-02", owned: false }),
      book({ title: "Sold in Sept", soldAt: "2026-09-10", owned: false }),
    ]);
    expect(toSell.map((b) => b.title)).toEqual(["New", "Old"]);
    expect(sold.map((b) => b.title)).toEqual(["Sold in Sept", "Sold in May"]);
  });

  it("totals what sold books earned, per currency", () => {
    expect(
      soldTotal([
        book({ soldAt: "2026-05-02", salePrice: 150 }),
        book({ soldAt: "2026-05-03", salePrice: 80.5 }),
        book({ soldAt: "2026-05-04" }),
        book({ forSale: true, salePrice: 999 }),
        book({ soldAt: "2026-05-05", salePrice: 10, currency: "SEK" }),
      ]),
    ).toEqual([
      { currency: "UAH", total: 230.5 },
      { currency: "SEK", total: 10 },
    ]);
  });

  it("labels a sale in another currency with its converted value", () => {
    // Money is formatted with a non-breaking space after the currency code.
    const plain = (l: ReturnType<typeof salePriceLabel>) => JSON.parse(JSON.stringify(l).replaceAll(" ", " ").replaceAll(" ", " "));
    expect(plain(salePriceLabel(book({ salePrice: 225.16, saleOriginalPrice: 50, saleOriginalCurrency: "SEK" })))).toEqual({ main: "SEK 50", converted: "UAH 225.16" });
    expect(plain(salePriceLabel(book({ salePrice: 180 })))).toEqual({ main: "UAH 180" });
    expect(salePriceLabel(book({}))).toBeNull();
  });

  it("totals what you actually got, per currency", () => {
    expect(
      receivedTotal([
        book({ soldAt: "2026-10-01", salePrice: 225.16, saleOriginalPrice: 50, saleOriginalCurrency: "SEK" }),
        book({ soldAt: "2026-10-02", salePrice: 135.1, saleOriginalPrice: 30, saleOriginalCurrency: "SEK" }),
        book({ soldAt: "2026-09-01", salePrice: 100 }),
      ]),
    ).toEqual([
      { currency: "SEK", total: 80 },
      { currency: "UAH", total: 100 },
    ]);
  });
});

