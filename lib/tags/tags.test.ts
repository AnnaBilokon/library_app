import { describe, expect, it } from "vitest";
import { cleanTagList, mergeTags, normalizeTag, renameInTags, resolveTagSuggestions, tagBooksPrompt, type TaggableBook } from "./tags";

const book = (id: string, o: Partial<TaggableBook> = {}): TaggableBook => ({ id, title: id, authors: [], genres: [], tags: [], ...o });

describe("tags", () => {
  it("treats case and spacing as the same tag", () => {
    expect(normalizeTag("  Відьми ")).toBe("відьми");
    expect(normalizeTag("Затишна   історія")).toBe("затишна історія");
    expect(cleanTagList(["Відьми", "відьми", " ", "сильні жінки"])).toEqual(["відьми", "сильні жінки"]);
  });

  it("keeps only listed tags the book doesn't have, at most four, for known refs", () => {
    const list = ["затишна історія", "відьми", "сильні жінки", "темна атмосфера", "родинні таємниці", "книги про книги"];
    const books = [book("a", { tags: ["Відьми"] }), book("b")];
    const r = resolveTagSuggestions(
      {
        books: [
          { ref: "t1", tags: ["відьми", "Затишна історія", "made up"] },
          { ref: "t2", tags: ["сильні жінки", "темна атмосфера", "родинні таємниці", "книги про книги", "затишна історія"] },
          { ref: "t9", tags: ["відьми"] },
        ],
      },
      books,
      list,
    );
    expect(r).toEqual([
      { bookId: "a", tags: ["затишна історія"] },
      { bookId: "b", tags: ["сильні жінки", "темна атмосфера", "родинні таємниці", "книги про книги"] },
    ]);
  });

  it("adds tags without repeats, and renames by merging", () => {
    expect(mergeTags(["Відьми", "ромком"], ["відьми", "затишна історія"])).toEqual(["Відьми", "ромком", "затишна історія"]);
    expect(renameInTags(["Відьми", "відьми", "ромком"], "Відьми", "відьми")).toEqual(["відьми", "ромком"]);
  });

  it("numbers the books and lists the tag list in the prompt", () => {
    const prompt = tagBooksPrompt([book("Тигролови", { authors: ["Іван Багряний"], genres: ["Classic"], description: "Втеча зі сталінського ешелону." })], ["пригоди"]);
    expect(prompt).toContain("<tag_list>\nпригоди\n</tag_list>");
    expect(prompt).toContain("t1 | Тигролови | Іван Багряний | genres: Classic | Втеча зі сталінського ешелону.");
  });
});
