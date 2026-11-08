import "server-only";

/**
 * A cover by ISBN from Bokus, a Swedish bookshop. Its image server has covers for most Swedish
 * books (children's books too) and many Ukrainian ones, which LIBRIS and often Google don't. For
 * an ISBN it has no cover for it answers with a "Bild saknas" placeholder, a PNG; real covers are
 * WebP. Only the headers are fetched. 383 px wide: sharp on a phone, about 50 KB.
 */
export async function bokusCover(isbn: string): Promise<string | undefined> {
  const url = `https://image.bokus.com/images/${isbn}_383x`;
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(4_000) });
    return res.ok && res.headers.get("content-type") === "image/webp" ? url : undefined;
  } catch {
    return undefined;
  }
}

/** The same books, with a Bokus cover for each one that has an ISBN but no cover yet. */
export function withBokusCovers<T extends { isbn?: string; coverUrl?: string }>(books: T[]): Promise<T[]> {
  return Promise.all(
    books.map(async (b) => {
      const coverUrl = !b.coverUrl && b.isbn ? await bokusCover(b.isbn) : undefined;
      return coverUrl ? { ...b, coverUrl } : b;
    }),
  );
}
