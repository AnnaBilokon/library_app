import type { BookFormSuggestions } from "@/components/books/book-form";
import type { Book } from "@/lib/types";
import { facets } from "./filters";

/** Autocomplete values for the book form, most used first. */
export function buildSuggestions(books: Book[]): BookFormSuggestions {
  const f = facets(books);
  const values = (list: { value: string }[]) => list.map((o) => o.value);
  return {
    authors: values(f.author),
    genres: values(f.genre),
    tags: values(f.tag),
    publishers: values(f.publisher),
    existing: books.map(({ id, title, authors, isbn }) => ({ id, title, authors, isbn })),
  };
}
