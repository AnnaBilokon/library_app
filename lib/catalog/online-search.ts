import "server-only";
import { normalizeIsbn } from "@/lib/isbn";
import { FetchError } from "@/lib/net/safe-fetch";
import { fromGoogleBooksSearch, fromOpenLibrarySearch, type OnlineBook } from "./import";
import { getJson } from "./isbn-lookup";

const LIMIT = 8;

/** The fields asked of Google, so each answer stays small. */
const GOOGLE_FIELDS = "items(id,volumeInfo(title,authors,publisher,publishedDate,pageCount,language,description,imageLinks,industryIdentifiers))";
const OPEN_LIBRARY_FIELDS = [
  "key", "title", "author_name", "cover_i", "number_of_pages_median",
  "editions", "editions.key", "editions.title", "editions.isbn", "editions.publisher", "editions.publish_date", "editions.language", "editions.cover_i",
].join(",");

/**
 * Searches Google Books and Open Library by title, author or ISBN, for books the catalog doesn't
 * have yet. Google runs only with GOOGLE_BOOKS_API_KEY: without one its quota is zero. Open Library
 * needs no key, but only knows Ukrainian titles in Latin letters ("Internat", not "Інтернат").
 * Returns null when neither could be reached; an empty list means they found nothing.
 */
export async function searchBooksOnline(q: string): Promise<OnlineBook[] | null> {
  const isbn = normalizeIsbn(q);
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  const google = key
    ? getJson(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(isbn ? `isbn:${isbn}` : q)}&maxResults=${LIMIT}&printType=books&fields=${encodeURIComponent(GOOGLE_FIELDS)}&key=${encodeURIComponent(key)}`,
      ).then(fromGoogleBooksSearch)
    : Promise.resolve([]);
  const openLibrary = getJson(
    `https://openlibrary.org/search.json?${isbn ? `isbn=${isbn}` : `q=${encodeURIComponent(q)}`}&limit=${LIMIT}&fields=${encodeURIComponent(OPEN_LIBRARY_FIELDS)}`,
  ).then(fromOpenLibrarySearch);

  const answers = await Promise.allSettled([google, openLibrary]);
  for (const a of answers) {
    if (a.status === "rejected" && !(a.reason instanceof FetchError) && !(a.reason instanceof SyntaxError)) throw a.reason;
  }
  const found = answers.flatMap((a) => (a.status === "fulfilled" ? [a.value] : []));
  if (found.length === 0 || (!key && answers[1].status === "rejected")) return null;
  // Google first (its records are fuller); the same ISBN from Open Library is left out.
  const seen = new Set<string>();
  return found.flat().filter((b) => {
    const id = b.isbn ?? b.key;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
