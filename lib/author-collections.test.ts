import { describe, expect, it } from "vitest";
import type { Book } from "@/lib/types";
import { authorCollections } from "./author-collections";

let n = 0;
const book = (title: string, authors: string[], o: Partial<Book> = {}) =>
  ({ id: `b${++n}`, title, authors, owned: true, wanted: false, status: "to-read", timesRead: 0, readings: [], ...o }) as unknown as Book;

describe("author collections", () => {
  const books = [
    book("Зимове сонцестояння", ["Розамунда Пілчер"], { status: "finished", timesRead: 1 }),
    book("Мушлі", ["Розамунда Пілчер"]),
    book("Повернення додому", ["Розамунда Пілчер"], { wanted: true, owned: false }),
    book("Вересень", ["Розамунда Пілчер"], { wanted: true, owned: false }),
    book("Позичена", ["Розамунда Пілчер"], { owned: false, status: "finished", timesRead: 1 }),
    book("Продана, не читана", ["Розамунда Пілчер"], { owned: false, soldAt: "2026-01-01" }),
    book("Одна книга", ["Самотній Автор"]),
    book("Разом", ["Автор А", "Автор Б"]),
    book("Ще одна", ["Автор А"], { wanted: true, owned: false }),
  ];

  it("splits each author's books into ones you have and ones you want", () => {
    const [p] = authorCollections(books);
    expect(p.author).toBe("Розамунда Пілчер");
    // Read-but-not-owned counts as had; sold-and-unread doesn't.
    expect(p.have.map((b) => b.title)).toEqual(["Зимове сонцестояння", "Мушлі", "Позичена"]);
    expect(p.read).toBe(2);
    expect(p.wanted.map((b) => b.title)).toEqual(["Вересень", "Повернення додому"]);
  });

  it("keeps authors with at least two books, most first", () => {
    expect(authorCollections(books).map((c) => [c.author, c.have.length + c.wanted.length])).toEqual([
      ["Розамунда Пілчер", 5],
      ["Автор А", 2],
    ]);
  });
});
