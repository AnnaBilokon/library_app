import { describe, expect, it } from "vitest";
import type { Edition } from "@/lib/catalog/editions";
import type { Book } from "@/lib/types";
import { MAX_PICKS, picksPrompt, preScore, readerProfile, resolvePicks, shortlist } from "./interest";

const finished = (title: string, o: Partial<Book> & { on?: string } = {}) =>
  ({
    id: title,
    title,
    authors: [],
    genres: [],
    tags: [],
    favorite: false,
    timesRead: 1,
    readings: [{ id: `${title}-r`, outcome: "finished", finishedAt: o.on ?? "2026-05-01" }],
    lastFinishedAt: o.on ?? "2026-05-01",
    ...o,
  }) as unknown as Book;

const edition = (title: string, o: Partial<Edition> = {}): Edition => ({
  id: title,
  title,
  authors: [],
  genres: [],
  status: "draft",
  createdAt: "2026-10-18",
  updatedAt: "2026-10-18",
  ...o,
});

const books = [
  finished("Я бачу вас цікавить пітьма", { authors: ["Ілларіон Павлюк"], genres: ["Thriller/Detective"], rating: 5, tags: ["темна атмосфера"] }),
  finished("Танець недоумка", { authors: ["Ілларіон Павлюк"], genres: ["Українська сучасна проза"], rating: 4 }),
  finished("Емма", { authors: ["Джейн Остін"], genres: ["Classic"], rating: 2 }),
  finished("Old", { authors: ["Someone"], genres: ["History"], rating: 5, on: "2019-01-01" }),
];

describe("picks for you", () => {
  const profile = readerProfile(books, "2026-10-19");

  it("builds the profile from the last three years, weighting by rating", () => {
    expect(profile.genres[0].genre).toBe("Thriller/Detective");
    expect(profile.genres.map((g) => g.genre)).not.toContain("History");
    expect(profile.genres.find((g) => g.genre === "Classic")!.weight).toBeLessThan(profile.genres[0].weight);
    expect(profile.authors).toContain("Ілларіон Павлюк");
    expect(profile.authors).not.toContain("Джейн Остін");
    expect(profile.tags).toEqual(["темна атмосфера"]);
  });

  it("scores a loved author highest, then genres they read, and drops the rest", () => {
    const pav = edition("Білий попіл", { authors: ["ілларіон павлюк"] });
    const thriller = edition("Сад кісток", { genres: ["Thriller/Detective"] });
    const cook = edition("Кулінарна книга", { genres: ["Cooking"] });
    expect(preScore(pav, profile)).toBeGreaterThan(preScore(thriller, profile));
    expect(shortlist([cook, thriller, pav], profile).map((e) => e.title)).toEqual(["Білий попіл", "Сад кісток"]);
  });

  it("keeps known refs only, each once, at most five", () => {
    const candidates = Array.from({ length: 8 }, (_, i) => edition(`Book ${i + 1}`));
    const r = resolvePicks(
      { picks: [{ ref: "r1", reason: "Same author." }, { ref: "r1", reason: "again" }, { ref: "r99", reason: "x" }, ...[2, 3, 4, 5, 6, 7].map((n) => ({ ref: `r${n}`, reason: "Fits." }))] },
      candidates,
    );
    expect(r).toHaveLength(MAX_PICKS);
    expect(r[0]).toEqual({ editionId: "Book 1", reason: "Same author." });
  });

  it("tells Claude the reader's taste and numbers the releases", () => {
    const prompt = picksPrompt(profile, [edition("Білий попіл", { authors: ["Ілларіон Павлюк"], genres: ["Thriller/Detective"] })]);
    expect(prompt).toContain("Authors they love: Ілларіон Павлюк");
    expect(prompt).toContain("r1 | Білий попіл | Ілларіон Павлюк | Thriller/Detective");
  });
});
