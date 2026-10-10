import { createSerializer } from "nuqs/server";
import { libraryParams, libraryUrlKeys } from "./search-params";

/** Builds a /library link with filters applied, e.g. libraryUrl({ genre: ["Fiction"] }) → "/library?g=Fiction". */
export const libraryUrl = createSerializer(libraryParams, { urlKeys: libraryUrlKeys }).bind(null, "/library");

/** "Add a book" with fields filled in, e.g. newBookUrl({ wishlist: true, author: "Розамунда Пілчер" }). */
export function newBookUrl(p: { wishlist?: boolean; author?: string; series?: string; index?: number }): string {
  const q = new URLSearchParams();
  if (p.wishlist) q.set("wishlist", "1");
  if (p.author) q.set("author", p.author);
  if (p.series) q.set("series", p.series);
  if (p.index) q.set("index", String(p.index));
  const s = q.toString();
  return s ? `/books/new?${s}` : "/books/new";
}
