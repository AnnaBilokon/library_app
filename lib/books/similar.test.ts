import { describe, expect, it } from "vitest";
import type { Book } from "@/lib/types";
import type { Edition } from "@/lib/catalog/editions";
import { catalogShortlist, resolveAnswer, shelfCandidates, similarPrompt } from "./similar";

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

  it("numbers the unread books and adds what you loved and dropped", () => {
    const prompt = similarPrompt(current, shelfCandidates(current, all), all);
    expect(prompt).toContain("b1 | Mistborn — Brandon Sanderson | Fantasy");
    expect(prompt).toContain("b2 | A Wizard of Earthsea");
    expect(prompt).toContain('Gave up: "Too slow"');
    expect(prompt).not.toContain("The Wise Man's Fear");
  });

  it("maps refs back to books and drops unknown, repeated or wrong-list ones", () => {
    const candidates = shelfCandidates(current, all);
    const catalog = [edition("Kingkiller Chronicle Companion", { authors: ["Patrick Rothfuss"] }), edition("Elantris")];
    const r = resolveAnswer(
      {
        fromShelves: [
          { ref: "b2", reason: "Also about a gifted student at a school of magic." },
          { ref: "b2", reason: "again" },
          { ref: "b9", reason: "made up" },
          { ref: "Mistborn", reason: "not a ref" },
          { ref: "c1", reason: "wrong list" },
        ],
        fromCatalog: [
          { ref: "c1", reason: "Same author." },
          { ref: "b1", reason: "wrong list" },
        ],
      },
      candidates,
      catalog,
    );
    expect(r.fromShelves.map((s) => s.book.title)).toEqual(["A Wizard of Earthsea"]);
    expect(r.fromCatalog.map((s) => s.edition.title)).toEqual(["Kingkiller Chronicle Companion"]);
  });

  it("shortlists catalog books you don't have, closest first, then the newest", () => {
    const rows = [
      { id: "mine", title: "Mine", authors: ["Patrick Rothfuss"], genres: ["Fantasy"], createdAt: "2026-10-16" },
      { id: "old-cook", title: "Cookbook", authors: [], genres: ["Food"], createdAt: "2026-01-01" },
      { id: "new-cook", title: "New cookbook", authors: [], genres: ["Food"], createdAt: "2026-10-01" },
      { id: "fantasy", title: "Elantris", authors: ["Brandon Sanderson"], genres: ["Fantasy"], createdAt: "2026-02-01" },
      { id: "same-author", title: "Slow Regard", authors: ["Patrick Rothfuss"], genres: [], createdAt: "2025-01-01" },
    ];
    expect(catalogShortlist(current, rows, new Set(["mine"]))).toEqual(["same-author", "fantasy", "new-cook", "old-cook"]);
    expect(catalogShortlist(current, rows, new Set(), 2)).toEqual(["mine", "same-author"]);
  });

  it("puts the catalog shortlist into the prompt as c1, c2, …", () => {
    const prompt = similarPrompt(current, [], all, [edition("Elantris", { authors: ["Brandon Sanderson"], genres: ["Fantasy"] })]);
    expect(prompt).toContain("<in_catalog_not_owned>\nc1 | Elantris — Brandon Sanderson | Fantasy");
  });
});

function edition(title: string, o: Partial<Edition> = {}): Edition {
  return { id: title, title, authors: [], genres: [], status: "public", createdAt: "2026-10-16", updatedAt: "2026-10-16", ...o };
}
