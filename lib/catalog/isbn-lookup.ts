import "server-only";
import { FetchError, safeFetch } from "@/lib/net/safe-fetch";
import type { Prefill } from "@/lib/prefill/parse";
import { fromGoogleBooks, fromOpenLibrary } from "./import";

async function getJson(url: string): Promise<unknown> {
  const res = await safeFetch(url, { accept: "application/json", maxBytes: 2 * 1024 * 1024, timeoutMs: 10_000 });
  return JSON.parse(new TextDecoder().decode(res.body));
}

/**
 * Looks an ISBN up in Google Books, then Open Library. Both are free; Google needs
 * GOOGLE_BOOKS_API_KEY to be reliable (without a key it shares a tiny public quota and is
 * skipped when that's used up). Good for English titles, patchy for Ukrainian ones.
 */
export async function lookUpIsbn(isbn: string): Promise<(Prefill & { site: string }) | null> {
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  try {
    const found = fromGoogleBooks(
      await getJson(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}${key ? `&key=${encodeURIComponent(key)}` : ""}`),
      isbn,
    );
    if (found) return { ...found, site: "Google Books" };
  } catch (e) {
    if (!(e instanceof FetchError) && !(e instanceof SyntaxError)) throw e;
  }
  try {
    const found = fromOpenLibrary(await getJson(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`), isbn);
    if (found) return { ...found, site: "Open Library" };
  } catch (e) {
    if (!(e instanceof FetchError) && !(e instanceof SyntaxError)) throw e;
  }
  return null;
}
