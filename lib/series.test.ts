import { describe, expect, it } from "vitest";
import type { Book } from "@/lib/types";
import { seriesTracker } from "./series";

let n = 0;
const book = (series: string | undefined, seriesIndex: number | undefined, o: Partial<Book> = {}) =>
  ({
    id: `b${++n}`,
    title: `${series ?? "—"} ${seriesIndex ?? ""}`.trim(),
    authors: ["Авторка"],
    series,
    seriesIndex,
    owned: true,
    wanted: false,
    status: "to-read",
    timesRead: 0,
    readings: [],
    ...o,
  }) as unknown as Book;
const read = { status: "finished", timesRead: 1 } as Partial<Book>;

describe("series tracker", () => {
  const books = [
    book("Бріджертони", 1, read),
    book("Бріджертони", 2, read),
    book("Бріджертони", 3, { status: "reading" }),
    book("Бріджертони", 4),
    book("Бріджертони", 6, { wanted: true, owned: false }),
    book("Кафе", 1, read),
    book("Кафе", 2, read),
    book("Служниця", 1),
    book("Служниця", 2),
    book("Служниця", undefined),
    book(undefined, undefined, read),
  ];

  it("gives each volume a state, with gaps as missing", () => {
    const [b] = seriesTracker(books, { Бріджертони: 8 });
    expect(b.name).toBe("Бріджертони");
    expect(b.volumes.map((v) => v.state)).toEqual(["read", "read", "reading", "owned", "missing", "wishlist", "missing", "missing"]);
    expect(b.read).toBe(2);
    expect(b.missing).toEqual([5, 7, 8]);
    expect(b.next?.index).toBe(3);
    expect(b.status).toBe("reading");
  });

  it("knows caught up, finished, not started; and orders them", () => {
    const s = seriesTracker(books);
    expect(s.map((x) => [x.name, x.status])).toEqual([
      ["Бріджертони", "reading"],
      ["Кафе", "caught-up"],
      ["Служниця", "not-started"],
    ]);
    // Without a total, volumes run to the highest number you have.
    expect(s[0].volumes).toHaveLength(6);
    expect(seriesTracker(books, { Кафе: 2 }).find((x) => x.name === "Кафе")?.status).toBe("finished");
    expect(seriesTracker(books, { Кафе: 3 }).find((x) => x.name === "Кафе")?.missing).toEqual([3]);
  });

  it("keeps books without a number apart, and suggests the first unread one you own", () => {
    const s = seriesTracker(books).find((x) => x.name === "Служниця")!;
    expect(s.unnumbered).toHaveLength(1);
    expect(s.next).toMatchObject({ index: 1 });
    // A sold book doesn't count as on your shelf.
    const sold = seriesTracker([book("Х", 1, { owned: false, soldAt: "2026-01-01" })])[0];
    expect(sold.volumes[0].state).toBe("missing");
  });
});
