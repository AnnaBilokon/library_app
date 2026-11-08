import "server-only";
import { FetchError, safeFetch } from "@/lib/net/safe-fetch";
import type { Prefill } from "@/lib/prefill/parse";
import { bokusCover } from "./bokus-cover";
import { fromGoogleBooks, fromLibrisSearch, fromOpenLibrary } from "./import";

export async function getJson(url: string): Promise<unknown> {
  const res = await safeFetch(url, { accept: "application/json", maxBytes: 2 * 1024 * 1024, timeoutMs: 10_000 });
  return JSON.parse(new TextDecoder().decode(res.body));
}

/** Runs one source's lookup; a source that can't be reached or answers nonsense counts as not finding it. */
async function attempt<T>(lookUp: () => Promise<T | null | undefined>): Promise<T | null> {
  try {
    return (await lookUp()) ?? null;
  } catch (e) {
    if (!(e instanceof FetchError) && !(e instanceof SyntaxError)) throw e;
    return null;
  }
}

/**
 * Google Books' record for an ISBN. GOOGLE_BOOKS_API_KEY makes it reliable (without a key it
 * shares a tiny public quota and finds nothing once that's used up).
 */
function googleBooks(isbn: string): Promise<Prefill | null> {
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  return attempt(async () =>
    fromGoogleBooks(await getJson(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}${key ? `&key=${encodeURIComponent(key)}` : ""}`), isbn),
  );
}

/**
 * Looks an ISBN up in Google Books, then LIBRIS, then Open Library, all free. Google is good for
 * English titles; LIBRIS for Swedish ones, and it knows many Ukrainian editions too. A book found
 * without a cover gets one from Bokus when it has one.
 */
export async function lookUpIsbn(isbn: string): Promise<(Prefill & { site: string }) | null> {
  const found =
    (await googleBooks(isbn).then((b) => b && { ...b, site: "Google Books" })) ??
    // Matched on the ISBN itself: a search can also turn up a book that only mentions it.
    (await attempt(async () =>
      fromLibrisSearch(await getJson(`https://libris.kb.se/xsearch?query=isbn:${isbn}&format=json&n=5`)).find((b) => b.isbn === isbn),
    )) ??
    (await attempt(async () => fromOpenLibrary(await getJson(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`), isbn)).then(
      (b) => b && { ...b, site: "Open Library" },
    ));
  if (!found || found.coverUrl) return found;
  const coverUrl = await bokusCover(isbn);
  return coverUrl ? { ...found, coverUrl } : found;
}

/**
 * The description and page count for an ISBN, for a book picked from a source that has neither
 * (LIBRIS). Only Google Books has them, and for Swedish books not always.
 */
export async function lookUpMoreDetails(isbn: string): Promise<Pick<Prefill, "description" | "pages">> {
  const google = await googleBooks(isbn);
  return { description: google?.description, pages: google?.pages };
}
