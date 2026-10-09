import { describe, expect, it } from "vitest";
import { convert, formatRate } from "./currency";

describe("currency", () => {
  it("converts at a rate and rounds to cents", () => {
    expect(convert(50, 4.5032)).toBe(225.16);
    expect(convert(99.5, 1)).toBe(99.5);
  });

  it("shows rates with up to 4 decimals", () => {
    expect(formatRate(4.503219)).toBe("4.5032");
    expect(formatRate(0.2)).toBe("0.2");
  });
});
