import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsFloat,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";
import { SORT_KEYS } from "@/lib/books/filters";
import { BOOK_FORMATS, BOOK_STATUSES } from "@/lib/types";

/**
 * How each Library filter is stored in the URL (via nuqs). With `.withDefault`, a value equal
 * to the default is removed from the URL, so a plain /library stays clean.
 */
export const libraryParams = {
  q: parseAsString.withDefault(""),
  status: parseAsArrayOf(parseAsStringLiteral(BOOK_STATUSES)).withDefault([]),
  genre: parseAsArrayOf(parseAsString).withDefault([]),
  tag: parseAsArrayOf(parseAsString).withDefault([]),
  author: parseAsString,
  language: parseAsArrayOf(parseAsString).withDefault([]),
  format: parseAsArrayOf(parseAsStringLiteral(BOOK_FORMATS)).withDefault([]),
  publisher: parseAsArrayOf(parseAsString).withDefault([]),
  series: parseAsString,
  owned: parseAsBoolean,
  favorite: parseAsBoolean,
  reread: parseAsBoolean,
  ratingMin: parseAsFloat,
  ratingMax: parseAsFloat,
  finishedYear: parseAsInteger,
  pagesMin: parseAsInteger,
  pagesMax: parseAsInteger,
  sort: parseAsStringLiteral(SORT_KEYS).withDefault("title"),
  dir: parseAsStringLiteral(["asc", "desc"] as const).withDefault("asc"),
};

/** Short URL keys, e.g. ?g=Fiction&y=2024 instead of ?genre=Fiction&finishedYear=2024. */
export const libraryUrlKeys = {
  status: "s",
  genre: "g",
  tag: "t",
  author: "a",
  language: "lang",
  format: "fmt",
  publisher: "pub",
  favorite: "fav",
  reread: "rr",
  ratingMin: "rmin",
  ratingMax: "rmax",
  finishedYear: "y",
  pagesMin: "pmin",
  pagesMax: "pmax",
} as const;
