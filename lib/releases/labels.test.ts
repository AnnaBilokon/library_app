import { describe, expect, it } from "vitest";
import { byReleaseDate, releaseLabel } from "./labels";

describe("release dates", () => {
  it("says coming or out from an exact date, else the publisher's words", () => {
    expect(releaseLabel({ releaseDate: "2026-11-15" }, "2026-10-19")).toMatch(/^Coming .*2026$/);
    expect(releaseLabel({ releaseDate: "2026-06-23" }, "2026-10-19")).toMatch(/^Out .*2026$/);
    expect(releaseLabel({ releaseNote: "Очікується наприкінці 2026 року" }, "2026-10-19")).toBe("Очікується наприкінці 2026 року");
    expect(releaseLabel({}, "2026-10-19")).toBeUndefined();
  });

  it("sorts dated releases soonest first, undated last", () => {
    const list = [{ releaseDate: undefined }, { releaseDate: "2026-12-01" }, { releaseDate: "2026-11-01" }];
    expect(list.sort(byReleaseDate).map((e) => e.releaseDate)).toEqual(["2026-11-01", "2026-12-01", undefined]);
  });
});
