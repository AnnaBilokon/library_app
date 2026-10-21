import { describe, expect, it } from "vitest";
import type { Book } from "@/lib/types";
import { favouritesSummary, groupFavourites } from "./favourites";

const book = (title: string, o: Partial<Book> = {}) => ({ id: title, title, authors: [], genres: [], favorite: true, ...o }) as unknown as Book;

const books = [
  book("Тигролови", { authors: ["Іван Багряний"], genres: ["Classic"], rating: 5, lastFinishedAt: "2024-03-01" }),
  book("Сад Гетсиманський", { authors: ["Іван Багряний"], genres: ["Classic", "History"], rating: 4.5, lastFinishedAt: "2026-02-01" }),
  book("Емма", { authors: ["Джейн Остін"], genres: ["Classic"], lastFinishedAt: "2026-07-01" }),
  book("Ще не читала", { authors: ["Хтось"], genres: [] }),
];
const titles = (bs: Book[]) => bs.map((b) => b.title);

describe("favourites", () => {
  it("sums them up: count, average rating, authors and genres with 2+ favourites", () => {
    expect(favouritesSummary(books)).toEqual({
      count: 4,
      averageRating: 4.8,
      topAuthors: [{ name: "Іван Багряний", books: 2 }],
      topGenres: [{ name: "Classic", books: 3 }],
    });
  });

  it("groups by year read, newest first, unread last", () => {
    const groups = groupFavourites(books, "year");
    expect(groups.map((g) => g.label)).toEqual(["2026", "2024", "Not finished yet"]);
    expect(titles(groups[0].books)).toEqual(["Емма", "Сад Гетсиманський"]);
  });

  it("groups by genre (a book in each of its genres) and by author, biggest first", () => {
    expect(groupFavourites(books, "genre").map((g) => [g.label, g.books.length])).toEqual([
      ["Classic", 3],
      ["History", 1],
      ["No genre", 1],
    ]);
    expect(groupFavourites(books, "author")[0]).toMatchObject({ label: "Іван Багряний" });
  });

  it("shows them all together, most recently finished first", () => {
    expect(titles(groupFavourites(books, "none")[0].books)).toEqual(["Емма", "Сад Гетсиманський", "Тигролови", "Ще не читала"]);
    expect(groupFavourites([], "none")).toEqual([]);
  });
});
