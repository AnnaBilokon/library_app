import { describe, expect, it } from "vitest";
import { fromGoogleBooks, fromGoogleBooksSearch, fromOpenLibrary, fromOpenLibrarySearch, parseImportList } from "./import";

describe("parsing a pasted list", () => {
  it("sorts lines into links, ISBNs and lines it can't use, skipping blanks and repeats", () => {
    const lines = parseImportList(
      ["https://vivat.com.ua/product/yak/", "", "978-617-8012-13-7", "  9786178012137  ", "not a book", "https://vivat.com.ua/product/yak/", "0261102214"].join("\n"),
    );
    expect(lines).toEqual([
      { kind: "link", text: "https://vivat.com.ua/product/yak/", url: "https://vivat.com.ua/product/yak/" },
      { kind: "isbn", text: "978-617-8012-13-7", isbn: "9786178012137" },
      { kind: "invalid", text: "not a book" },
      { kind: "isbn", text: "0261102214", isbn: "9780261102217" },
    ]);
  });

  it("treats a wrong check digit as not an ISBN", () => {
    expect(parseImportList("9786178012130")[0].kind).toBe("invalid");
  });
});

describe("ISBN lookups", () => {
  it("reads a Google Books volume", () => {
    const json = {
      items: [
        {
          volumeInfo: {
            title: "The Hobbit",
            authors: ["J. R. R. Tolkien"],
            publisher: "HarperCollins",
            publishedDate: "2009-04-01",
            pageCount: 310,
            language: "en",
            description: "<p>In a hole in the ground<br>there lived a hobbit.</p>",
            imageLinks: { thumbnail: "http://books.google.com/books/content?id=x&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api" },
          },
        },
      ],
    };
    expect(fromGoogleBooks(json, "9780261102217")).toEqual({
      title: "The Hobbit",
      authors: ["J. R. R. Tolkien"],
      publisher: "HarperCollins",
      publishedYear: 2009,
      pages: 310,
      isbn: "9780261102217",
      language: "en",
      coverUrl: "https://books.google.com/books/content?id=x&printsec=frontcover&img=1&zoom=2&source=gbs_api",
      description: "In a hole in the ground\nthere lived a hobbit.",
    });
  });

  it("reads an Open Library record (shape as returned for The Hobbit)", () => {
    const json = {
      "ISBN:9780261102217": {
        title: "The Hobbit",
        authors: [{ name: "J.R.R. Tolkien" }],
        publishers: [{ name: "HarperCollins" }],
        publish_date: "2009",
        number_of_pages: 310,
        cover: { large: "https://covers.openlibrary.org/b/id/12649317-L.jpg" },
      },
    };
    expect(fromOpenLibrary(json, "9780261102217")).toEqual({
      title: "The Hobbit",
      authors: ["J.R.R. Tolkien"],
      publisher: "HarperCollins",
      publishedYear: 2009,
      pages: 310,
      isbn: "9780261102217",
      coverUrl: "https://covers.openlibrary.org/b/id/12649317-L.jpg",
    });
  });

  it("returns nothing when the book isn't known", () => {
    expect(fromGoogleBooks({ totalItems: 0 }, "9786178012137")).toBeNull();
    expect(fromGoogleBooks({ error: { code: 429 } }, "9786178012137")).toBeNull();
    expect(fromOpenLibrary({}, "9786178012137")).toBeNull();
  });
});

describe("online search", () => {
  it("reads every Google Books volume, with its ISBN-13 (or ISBN-10 converted)", () => {
    const json = {
      items: [
        {
          id: "abc",
          volumeInfo: {
            title: "Інтернат",
            authors: ["Сергій Жадан"],
            publisher: "Meridian Czernowitz",
            publishedDate: "2017",
            language: "uk",
            industryIdentifiers: [
              { type: "ISBN_10", identifier: "9669767903" },
              { type: "ISBN_13", identifier: "9789669767905" },
            ],
          },
        },
        { id: "def", volumeInfo: { title: "The Hobbit", industryIdentifiers: [{ type: "ISBN_10", identifier: "0261102214" }] } },
        { id: "no-title", volumeInfo: {} },
      ],
    };
    expect(fromGoogleBooksSearch(json)).toEqual([
      expect.objectContaining({ title: "Інтернат", authors: ["Сергій Жадан"], publishedYear: 2017, isbn: "9789669767905", language: "uk", key: "google:abc", site: "Google Books" }),
      expect.objectContaining({ title: "The Hobbit", isbn: "9780261102217", key: "google:def" }),
    ]);
  });

  it("reads Open Library works with their best-matching edition (shape as returned for Жадан)", () => {
    const json = {
      docs: [
        {
          author_name: ["Сергі́й Ві́кторович Жада́н"],
          cover_i: 10216915,
          key: "/works/OL20887986W",
          title: "Internat",
          number_of_pages_median: 336,
          editions: {
            docs: [
              {
                key: "/books/OL28291759M",
                title: "Internat",
                language: ["ukr"],
                publisher: ["Meridian Czernowitz"],
                publish_date: ["Jun 27, 2017"],
                isbn: ["9789669767905", "9669767903"],
              },
            ],
          },
        },
        { key: "/works/OL1W", title: "Bilingual", editions: { docs: [{ key: "/books/OL1M", language: ["ukr", "eng"] }] } },
      ],
    };
    expect(fromOpenLibrarySearch(json)).toEqual([
      {
        title: "Internat",
        authors: ["Сергі́й Ві́кторович Жада́н"],
        publisher: "Meridian Czernowitz",
        publishedYear: 2017,
        pages: 336,
        isbn: "9789669767905",
        language: "uk",
        coverUrl: "https://covers.openlibrary.org/b/id/10216915-L.jpg",
        key: "openlibrary:/books/OL28291759M",
        site: "Open Library",
      },
      expect.objectContaining({ title: "Bilingual", language: undefined, isbn: undefined, coverUrl: undefined, key: "openlibrary:/books/OL1M" }),
    ]);
  });

  it("finds nothing in an error or an empty answer", () => {
    expect(fromGoogleBooksSearch({ error: { code: 429 } })).toEqual([]);
    expect(fromOpenLibrarySearch({ numFound: 0, docs: [] })).toEqual([]);
    expect(fromOpenLibrarySearch(null)).toEqual([]);
  });
});
