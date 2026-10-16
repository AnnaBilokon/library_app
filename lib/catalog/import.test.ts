import { describe, expect, it } from "vitest";
import { fromGoogleBooks, fromOpenLibrary, parseImportList } from "./import";

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
