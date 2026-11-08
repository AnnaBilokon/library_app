import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps paths on this site", () => {
    expect(safeNext("/books/1?tab=notes")).toBe("/books/1?tab=notes");
    expect(safeNext("/reset-password")).toBe("/reset-password");
  });

  it("falls back to the home page for anything else", () => {
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext(null)).toBe("/");
    expect(safeNext("")).toBe("/");
    expect(safeNext("https://evil.com")).toBe("/");
    expect(safeNext("//evil.com")).toBe("/");
    // Browsers read a backslash as a slash, so this is "//evil.com" too.
    expect(safeNext("/\\evil.com")).toBe("/");
  });
});
