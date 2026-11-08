import { describe, expect, it } from "vitest";
import { isbnFromBarcode, normalizeIsbn } from "./isbn";

describe("normalizeIsbn", () => {
  it("turns ISBN-10 and hyphenated ISBN-13 into 13 digits", () => {
    expect(normalizeIsbn("0-14-044913-2")).toBe("9780140449136");
    expect(normalizeIsbn("978-0-14-044913-6")).toBe("9780140449136");
  });

  it("rejects a wrong check digit", () => {
    expect(normalizeIsbn("9780140449137")).toBeNull();
  });
});

describe("isbnFromBarcode", () => {
  it("reads the ISBN from a book's barcode (978 or 979)", () => {
    expect(isbnFromBarcode("9780140449136")).toBe("9780140449136");
    expect(isbnFromBarcode("9791032305690")).toBe("9791032305690");
  });

  it("ignores other barcodes, even with a valid check digit", () => {
    // Valid EAN-13s, but not books: a book's ISBN only ever starts 978 or 979.
    expect(isbnFromBarcode("6171500631019")).toBeNull();
    expect(isbnFromBarcode("4006381333931")).toBeNull();
    expect(isbnFromBarcode("9780140449137")).toBeNull();
    expect(isbnFromBarcode("0140449132")).toBeNull();
  });
});
