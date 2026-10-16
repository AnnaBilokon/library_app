import { describe, expect, it } from "vitest";
import { describePattern, extractLinks, guessBookPattern, isPageOf, listingKey, matchesPattern, pageLinks, parsePattern, walkListing } from "./collect";

// The shape of KSD's "Анонси" page: a category menu, pagination, and book cards linking to /product/<slug>.
const listing = "https://ksd.ua/books/special/anonsy";
const page = (n: number) => `
  <nav>
    <a href="/">Home</a><a href="/news">News</a><a href="/shops">Shops</a>
    <a href="/books/special/all">All</a><a href="/books/special/anonsy">Анонси</a>
    <a href="/books/special/novynky-ksd">Новинки</a><a href="/books/special/khity-prodazu">Хіти</a>
    <a href="/books/special/anonsy/filter/ebook">E-books</a>
  </nav>
  <a class="card" href="/product/book-${n}-a"><img></a><a href="/product/book-${n}-a">Book A</a>
  <a class="card" href="/product/book-${n}-b">Book B</a>
  <a class="card" href="https://ksd.ua/product/book-${n}-c#reviews">Book C</a>
  <a href="/product/book-${n}-d?utm=x&amp;y=1">Book D</a>
  <a href="https://other.example/product/elsewhere">Partner</a>
  <a href="/books/special/anonsy/page-2">2</a><a href="/books/special/anonsy/page-3">3</a>
`;

describe("collecting book links from a listing", () => {
  it("keeps same-site links, absolute, without fragments, each once", () => {
    const links = extractLinks(page(1), listing);
    expect(links).toContain("https://ksd.ua/product/book-1-a");
    expect(links).toContain("https://ksd.ua/product/book-1-c");
    expect(links).toContain("https://ksd.ua/product/book-1-d?utm=x&y=1");
    expect(links.filter((l) => l.endsWith("book-1-a"))).toHaveLength(1);
    expect(links.some((l) => l.includes("other.example"))).toBe(false);
  });

  it("guesses that the books are the /product/<name> links, not the category menu", () => {
    const pattern = guessBookPattern(extractLinks(page(1), listing), listing);
    expect(pattern).toEqual({ prefix: "/product/", depth: 2 });
    expect(describePattern(pattern!)).toBe("/product/");
    const books = extractLinks(page(1), listing).filter((l) => matchesPattern(l, pattern!));
    expect(books).toHaveLength(4);
  });

  it("recognises the listing's other pages, in the path or the query", () => {
    expect(isPageOf("https://ksd.ua/books/special/anonsy/page-2", listing)).toBe(true);
    expect(isPageOf("https://ksd.ua/books/special/anonsy/page/3/", listing)).toBe(true);
    expect(isPageOf("https://shop.example/new?page=2&sort=date", "https://shop.example/new?sort=date")).toBe(true);
    expect(isPageOf("https://ksd.ua/books/special/novynky-ksd/page-2", listing)).toBe(false);
    expect(isPageOf("https://ksd.ua/books/special/anonsy/filter/ebook", listing)).toBe(false);
    expect(listingKey("https://ksd.ua/books/special/anonsy/page-4")).toBe(listingKey(listing));
  });

  it("finds nothing when no group of links stands out", () => {
    expect(guessBookPattern(extractLinks('<a href="/a/1">1</a><a href="/b/2">2</a>', listing), listing)).toBeNull();
  });

  it("reads a typed pattern as a path prefix, or a whole link", () => {
    expect(parsePattern("/product/")).toEqual({ prefix: "/product/" });
    expect(parsePattern("knyha/")).toEqual({ prefix: "/knyha/" });
    expect(parsePattern("https://shop.example/books/item/")).toEqual({ prefix: "/books/item/" });
    expect(parsePattern("  ")).toBeNull();
    expect(matchesPattern("https://ksd.ua/product/x", { prefix: "/product/" })).toBe(true);
    expect(matchesPattern("https://ksd.ua/product/", { prefix: "/product/" })).toBe(false);
  });

  it("follows numbered page links, and <link rel=\"next\"> where a site has a Show more button instead", () => {
    expect(pageLinks(page(1), listing, listing)).toEqual(["https://ksd.ua/books/special/anonsy/page-2", "https://ksd.ua/books/special/anonsy/page-3"]);
    const vivat = '<head><link rel="next" href="https://vivat.com.ua/novynky-knyh/?page=2"/></head><button>Показати ще</button>';
    expect(pageLinks(vivat, "https://vivat.com.ua/novynky-knyh/", "https://vivat.com.ua/novynky-knyh/")).toEqual(["https://vivat.com.ua/novynky-knyh/?page=2"]);
  });

  it("walks every page of the listing, once each, and collects the books in order", async () => {
    const pages: Record<string, string> = {
      [listing]: page(1),
      [`${listing}/page-2`]: page(2),
      // Page 3 links on to page 4, which page 1 didn't show.
      [`${listing}/page-3`]: `${page(3)}<a href="/books/special/anonsy/page-4">4</a>`,
      [`${listing}/page-4`]: page(4),
    };
    const fetched: string[] = [];
    const walk = await walkListing(listing, null, async (url) => (fetched.push(url), pages[url]), { pauseMs: 0 });
    expect(walk?.pages).toBe(4);
    expect(walk?.links).toHaveLength(16);
    expect(walk?.links[0]).toBe("https://ksd.ua/product/book-1-a");
    expect(new Set(fetched).size).toBe(fetched.length);
  });

  it("stops at the page limit, and keeps what it found when a later page fails", async () => {
    const limited = await walkListing(listing, null, async () => page(1), { maxPages: 1, pauseMs: 0 });
    expect(limited?.note).toMatch(/first 1 pages/);
    const broken = await walkListing(
      listing,
      null,
      async (url) => {
        if (url !== listing) throw new Error("HTTP 500");
        return page(1);
      },
      { pauseMs: 0 },
    );
    expect(broken?.links).toHaveLength(4);
    expect(broken?.note).toMatch(/Stopped at page 2/);
    await expect(walkListing(listing, null, async () => Promise.reject(new Error("HTTP 404")), { pauseMs: 0 })).rejects.toThrow("404");
  });
});
