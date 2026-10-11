import { describe, expect, it } from "vitest";
import { dmyToIso, isoToDmy } from "./dates";

describe("day.month.year dates", () => {
  it("shows stored dates as day.month.year", () => {
    expect(isoToDmy("2026-10-11")).toBe("11.10.2026");
    expect(isoToDmy("")).toBe("");
  });

  it("reads what you type, in any separator", () => {
    expect(dmyToIso("11.10.2026")).toBe("2026-10-11");
    expect(dmyToIso("1/2/2026")).toBe("2026-02-01");
    expect(dmyToIso("11-10-26")).toBe("2026-10-11");
    expect(dmyToIso(" 05 03 2024 ")).toBe("2024-03-05");
    expect(dmyToIso("")).toBe("");
  });

  it("refuses dates that don't exist", () => {
    expect(dmyToIso("31.02.2026")).toBeNull();
    expect(dmyToIso("13.13.2026")).toBeNull();
    expect(dmyToIso("2026-10-11")).toBeNull();
    expect(dmyToIso("tomorrow")).toBeNull();
  });
});
