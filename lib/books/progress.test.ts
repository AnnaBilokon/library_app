import { describe, expect, it } from "vitest";
import { progressInfo } from "./progress";

describe("progressInfo", () => {
  it("shows a page with the percentage when the page count is known", () => {
    expect(progressInfo({ progressPage: 120 }, 340)).toEqual({ page: 120, percent: 35, label: "p. 120 of 340 · 35%" });
  });

  it("shows just the page when the page count is unknown", () => {
    expect(progressInfo({ progressPage: 120 })).toEqual({ page: 120, percent: undefined, label: "p. 120" });
  });

  it("shows a saved percentage", () => {
    expect(progressInfo({ progressPercent: 42.4 })).toEqual({ percent: 42, label: "42%" });
  });

  it("caps at 100% and handles no progress", () => {
    expect(progressInfo({ progressPage: 400 }, 340)?.percent).toBe(100);
    expect(progressInfo({}, 340)).toBeNull();
    expect(progressInfo(undefined)).toBeNull();
  });
});
