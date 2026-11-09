import { describe, expect, it } from "vitest";
import { fromGoogleBooks, fromGoogleBooksSearch, fromLibrisSearch, fromLibrisXl, fromOpenLibrary, fromOpenLibrarySearch, parseImportList } from "./import";

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

  it("reads LIBRIS books, leaving out articles, films and talking books (shapes as returned)", () => {
    const json = {
      xsearch: {
        list: [
          {
            identifier: "http://libris.kb.se/bib/095p9hsgxln9mjfr",
            title: "Pippi Långstrump",
            creator: "Lindgren, Astrid, 1907-2002",
            isbn: "9789189035003",
            type: "text",
            publisher: ["Lidingö", "Astrid Lindgren AB"],
            date: "2019",
            language: "swe",
          },
          {
            identifier: "http://libris.kb.se/bib/internat",
            title: "Інтернат : роман ’Internat : roman’",
            creator: "Жадан, Сергій, 1974- ’Žadan, Serhij, 1974-’",
            isbn: "9786178024017",
            type: "book",
            publisher: "Černivci : Meridian Czernowitz",
            date: ["[2024]", "2024"],
            language: "ukr",
          },
          {
            identifier: "http://libris.kb.se/bib/harvest",
            title: "A harvest truce : a play",
            creator: "Žadan, Serhij, 1974-",
            isbn: ["9780674291997", "0674291999"],
            type: "book",
            publisher: ["", "Cambridge : Ukrainian Research Institute, Harvard University"],
            date: ["2023", "[2024]"],
            language: ["eng", "ukr"],
          },
          { identifier: "http://libris.kb.se/bib/film", title: "Pippi Långstrump", type: "moving image" },
          { identifier: "http://libris.kb.se/bib/article", title: "Verkligheten är saga nog", type: "article" },
          { identifier: "http://libris.kb.se/bib/mtm", title: "Spisok korabliv", type: "" },
        ],
      },
    };
    expect(fromLibrisSearch(json)).toEqual([
      {
        title: "Pippi Långstrump",
        authors: ["Astrid Lindgren"],
        publisher: "Astrid Lindgren AB",
        publishedYear: 2019,
        isbn: "9789189035003",
        language: "sv",
        key: "libris:http://libris.kb.se/bib/095p9hsgxln9mjfr",
        site: "LIBRIS",
      },
      expect.objectContaining({ title: "Інтернат", authors: ["Сергій Жадан"], publisher: "Meridian Czernowitz", publishedYear: 2024, language: "uk" }),
      expect.objectContaining({
        title: "A harvest truce",
        authors: ["Serhij Žadan"],
        publisher: "Ukrainian Research Institute, Harvard University",
        isbn: "9780674291997",
        language: undefined,
      }),
    ]);
  });

  it("reads the summary and page count from a LIBRIS XL record (shapes as returned)", () => {
    const record = (isbn: string, summary: unknown, extent: unknown) => ({ items: [{ identifiedBy: [{ "@type": "ISBN", value: isbn }], summary, extent }] });
    expect(
      fromLibrisXl(
        record("9789157033352", [{ "@type": "Summary", label: ["Rune Andréasson-historia i nytappning.[Bokinfo]"] }], [{ "@type": "Extent", label: "45 sidor" }]),
        "9789157033352",
      ),
    ).toEqual({ description: "Rune Andréasson-historia i nytappning.", pages: 45 });
    expect(fromLibrisXl(record("9789129688313", undefined, [{ "@type": "Extent", label: ["248 s."] }]), "9789129688313")).toEqual({
      description: undefined,
      pages: 248,
    });
    expect(fromLibrisXl(record("9789129740240", undefined, [{ label: "33 onumrerade sidor" }]), "9789129740240").pages).toBe(33);
    expect(fromLibrisXl(record("9789129740240", undefined, [{ label: "[32] s." }]), "9789129740240").pages).toBe(32);
    // Another book's record, or none at all: nothing.
    expect(fromLibrisXl(record("9789129740240", [{ label: "Fel bok" }], undefined), "9789129688313")).toEqual({});
    expect(fromLibrisXl({ totalItems: 0, items: [] }, "9789129688313")).toEqual({});
  });

  it("keeps an apostrophe in a LIBRIS title", () => {
    const json = { xsearch: { list: [{ identifier: "x", title: "Don’t let the pigeon drive the bus!", creator: "Mo Willems", type: "book" }] } };
    expect(fromLibrisSearch(json)).toEqual([expect.objectContaining({ title: "Don’t let the pigeon drive the bus!", authors: ["Mo Willems"] })]);
  });

  it("finds nothing in an error or an empty answer", () => {
    expect(fromGoogleBooksSearch({ error: { code: 429 } })).toEqual([]);
    expect(fromOpenLibrarySearch({ numFound: 0, docs: [] })).toEqual([]);
    expect(fromOpenLibrarySearch(null)).toEqual([]);
    expect(fromLibrisSearch({ xsearch: { from: 1, to: 0, records: 0 } })).toEqual([]);
    expect(fromLibrisSearch(null)).toEqual([]);
  });
});
