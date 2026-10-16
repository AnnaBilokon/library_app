import { describe, expect, it } from "vitest";
import type { Book } from "@/lib/types";
import { resolveAnswer, shelfCandidates, similarPrompt } from "./similar";

const book = (title: string, o: Partial<Book> = {}) =>
  ({ id: title, title, authors: [], genres: [], tags: [], owned: true, wanted: false, forgotten: false, favorite: false, status: "to-read", timesRead: 0, readings: [], ...o }) as unknown as Book;

const current = book("The Name of the Wind", { authors: ["Patrick Rothfuss"], genres: ["Fantasy"], status: "finished", timesRead: 1, rating: 5 });
const all = [
  current,
  book("Mistborn", { authors: ["Brandon Sanderson"], genres: ["Fantasy"] }),
  book("A Wizard of Earthsea", { authors: ["Ursula K. Le Guin"], genres: ["Fantasy", "Classic"] }),
  book("Dune", { authors: ["Frank Herbert"], genres: ["Sci-fi"], status: "finished", timesRead: 1 }),
  book("Reading now", { status: "reading" }),
  book("The Wise Man's Fear", { authors: ["Patrick Rothfuss"], wanted: true, owned: false }),
  book("Gave up", { status: "abandoned", readings: [{ id: "r", outcome: "abandoned", stopReason: "Too slow" }] }),
];

describe("books like this", () => {
  it("picks from unread books on your shelves, never the book itself", () => {
    expect(shelfCandidates(current, all).map((b) => b.title)).toEqual(["Mistborn", "A Wizard of Earthsea"]);
  });

  it("lists books sharing a genre or author first", () => {
    const shelf = [current, book("Cookbook", { genres: ["Food"] }), book("Earthsea", { genres: ["Fantasy"] }), book("Doors of Stone", { authors: ["Patrick Rothfuss"] })];
    expect(shelfCandidates(current, shelf).map((b) => b.title)).toEqual(["Doors of Stone", "Earthsea", "Cookbook"]);
  });

  it("numbers the unread books and lists what you already have", () => {
    const prompt = similarPrompt(current, shelfCandidates(current, all), all);
    expect(prompt).toContain("b1 | Mistborn — Brandon Sanderson | Fantasy");
    expect(prompt).toContain("b2 | A Wizard of Earthsea");
    expect(prompt).toContain('Gave up: "Too slow"');
    expect(prompt).toContain("The Wise Man's Fear — Patrick Rothfuss");
  });

  it("maps refs back to books and drops unknown or repeated ones", () => {
    const candidates = shelfCandidates(current, all);
    const r = resolveAnswer(
      {
        fromShelves: [
          { ref: "b2", reason: "Also about a gifted student at a school of magic." },
          { ref: "b2", reason: "again" },
          { ref: "b9", reason: "made up" },
          { ref: "Mistborn", reason: "not a ref" },
        ],
        newBooks: [],
      },
      candidates,
      all,
    );
    expect(r.fromShelves.map((s) => s.book.title)).toEqual(["A Wizard of Earthsea"]);
  });

  it("leaves out new books you already have, and genres you don't use", () => {
    const r = resolveAnswer(
      {
        fromShelves: [],
        newBooks: [
          { title: "The Wise Man’s Fear", authors: ["Patrick Rothfuss"], year: 2011, genres: ["Fantasy"], reason: "The sequel." },
          { title: "The Lies of Locke Lamora", authors: ["Scott Lynch"], year: 2006, genres: ["Fantasy", "Heist"], reason: "Same voice." },
          { title: "The lies of Locke Lamora", authors: ["Scott Lynch"], year: null, genres: [], reason: "Repeated." },
          { title: "Dune", authors: ["Frank Herbert"], year: null, genres: [], reason: "Already read." },
        ],
      },
      [],
      all,
    );
    expect(r.newBooks).toEqual([{ title: "The Lies of Locke Lamora", authors: ["Scott Lynch"], year: 2006, genres: ["Fantasy"], reason: "Same voice." }]);
  });
});
