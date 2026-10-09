import { describe, expect, it } from "vitest";
import type { Book } from "@/lib/types";
import { nextQueueOrder, queueOf } from "./queue";

describe("nextQueueOrder", () => {
  const q = ["a", "b", "c"];

  it("appends a new book to the end, and leaves an existing one where it is", () => {
    expect(nextQueueOrder(q, "d", "append")).toEqual(["a", "b", "c", "d"]);
    expect(nextQueueOrder(q, "b", "append")).toEqual(["a", "b", "c"]);
  });

  it("pins a book to the top, moving it if it was already queued", () => {
    expect(nextQueueOrder(q, "c", "pin")).toEqual(["c", "a", "b"]);
    expect(nextQueueOrder(q, "d", "pin")).toEqual(["d", "a", "b", "c"]);
  });

  it("removes a book", () => {
    expect(nextQueueOrder(q, "b", "remove")).toEqual(["a", "c"]);
    expect(nextQueueOrder(q, "x", "remove")).toEqual(q);
  });
});

describe("queueOf", () => {
  it("keeps only queued books, in queue order", () => {
    const book = (id: string, queuePosition?: number) => ({ id, queuePosition }) as Book;
    expect(queueOf([book("a", 3), book("b"), book("c", 1), book("d", 2)]).map((b) => b.id)).toEqual(["c", "d", "a"]);
  });
});
