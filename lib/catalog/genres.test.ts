import { describe, expect, it } from "vitest";
import { genresPrompt, resolveGenres } from "./genres";

const genres = ["Fantasy", "Thriller/Detective", "Romance", "Non-fiction"];
const books = [
  { id: "a", title: "Сад кісток", authors: ["Саймон Бекетт"], description: "Антрополог Девід Гантер і нове розслідування." },
  { id: "b", title: "Без кохання", authors: [] },
];

describe("sorting new books into your genres", () => {
  it("keeps only listed genres, written the list's way, at most two, each book once", () => {
    const r = resolveGenres(
      {
        books: [
          { ref: "g1", genres: ["thriller/detective", "Horror", "romance", "Fantasy"] },
          { ref: "g1", genres: ["Non-fiction"] },
          { ref: "g7", genres: ["Fantasy"] },
        ],
      },
      books,
      genres,
    );
    expect(r).toEqual([
      { id: "a", genres: ["Thriller/Detective", "Romance"] },
      { id: "b", genres: [] },
    ]);
  });

  it("numbers the books and lists your genres in the prompt", () => {
    const prompt = genresPrompt(books, genres);
    expect(prompt).toContain("<genre_list>\nFantasy\nThriller/Detective");
    expect(prompt).toContain("g1 | Сад кісток | Саймон Бекетт | Антрополог");
    expect(prompt).toContain("g2 | Без кохання");
  });
});
