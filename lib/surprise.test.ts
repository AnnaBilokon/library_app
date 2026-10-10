import { describe, expect, it } from "vitest";
import type { Book } from "@/lib/types";
import { applyGenre, poolBooks, recentGenres, spin } from "./surprise";

const book = (title: string, o: Partial<Book> = {}) =>
  ({ id: title, title, genres: [], owned: true, wanted: false, forgotten: false, status: "to-read", timesRead: 0, readings: [], ...o }) as unknown as Book;

const books = [
  book("Unread fantasy", { genres: ["Fantasy"] }),
  book("Unread history", { genres: ["History"] }),
  book("Read classic", { genres: ["Classic"], status: "finished", timesRead: 1, lastFinishedAt: "2026-09-01" }),
  book("Read fantasy", { genres: ["Fantasy"], status: "finished", timesRead: 1, lastFinishedAt: "2026-10-01" }),
  book("Reading now", { status: "reading" }),
  book("Paused", { status: "paused" }),
  book("Gave up", { status: "abandoned" }),
  book("Borrowed", { owned: false }),
  book("Wishlist", { wanted: true, owned: false }),
  book("Sold", { owned: false, soldAt: "2026-01-01" }),
  book("Forgotten classic", { genres: ["Classic"], forgotten: true, status: "finished", timesRead: 1, lastFinishedAt: "2020-01-01" }),
];
const titles = (bs: Book[]) => bs.map((b) => b.title);

describe("surprise me", () => {
  it("builds the pools", () => {
    expect(titles(poolBooks(books, "unread"))).toEqual(["Unread fantasy", "Unread history"]);
    expect(titles(poolBooks(books, "forgotten"))).toEqual(["Forgotten classic"]);
    expect(titles(poolBooks(books, "all"))).toEqual(["Unread fantasy", "Unread history", "Read classic", "Read fantasy", "Gave up", "Borrowed", "Forgotten classic"]);
  });

  it("filters by genre, or by something different from what you read lately", () => {
    const recent = recentGenres(books, 2);
    expect(recent).toEqual(["Fantasy", "Classic"]);
    const all = poolBooks(books, "all");
    expect(titles(applyGenre(all, { kind: "genre", genre: "Fantasy" }, recent))).toEqual(["Unread fantasy", "Read fantasy"]);
    expect(titles(applyGenre(all, { kind: "different" }, recent))).toEqual(["Unread history"]);
    expect(applyGenre(all, { kind: "any" }, recent)).toHaveLength(all.length);
  });

  it("spins a reel that ends on the pick, preferring books not shown yet", () => {
    const pool = poolBooks(books, "unread");
    let i = 0;
    const seq = [0.1, 0.9, 0.5];
    const r = spin(pool, new Set(["Unread fantasy"]), 6, () => seq[i++ % seq.length]);
    expect(r?.pick.title).toBe("Unread history");
    expect(r?.reel).toHaveLength(6);
    expect(r?.reel.at(-1)?.title).toBe("Unread history");
    // Everything already seen: picks among all again.
    expect(spin(pool, new Set(["Unread fantasy", "Unread history"]), 4, () => 0)?.pick.title).toBe("Unread fantasy");
    expect(spin([], new Set())).toBeNull();
  });
});
