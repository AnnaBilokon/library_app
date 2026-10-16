import { normalizeIsbn } from "@/lib/isbn";
import { decodeEntities, type Prefill } from "@/lib/prefill/parse";

/** At most this many lines are imported at once. */
export const IMPORT_LIMIT = 100;

export type ImportLine =
  | { kind: "link"; text: string; url: string }
  | { kind: "isbn"; text: string; isbn: string }
  | { kind: "invalid"; text: string };

/**
 * One link or ISBN per line (blank lines and repeats are skipped). Anything that's neither is
 * kept as "invalid", so the list can say which lines it couldn't use.
 */
export function parseImportList(text: string): ImportLine[] {
  const seen = new Set<string>();
  const lines: ImportLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    let item: ImportLine;
    if (/^https?:\/\/\S+$/i.test(line)) item = { kind: "link", text: line, url: line };
    else {
      const isbn = normalizeIsbn(line);
      item = isbn ? { kind: "isbn", text: line, isbn } : { kind: "invalid", text: line };
    }
    const key = item.kind === "isbn" ? `isbn:${item.isbn}` : item.kind === "link" ? `url:${item.url}` : `text:${line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(item);
  }
  return lines;
}

const year = (date: unknown) => {
  const m = typeof date === "string" ? /\b(1[5-9]\d\d|20\d\d)\b/.exec(date) : null;
  return m ? Number(m[1]) : undefined;
};
const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const positive = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v > 0 ? v : undefined);
/** Google's descriptions can carry a little HTML. */
const plain = (html: string | undefined) =>
  html && decodeEntities(html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "")).replace(/\n{3,}/g, "\n\n").trim();

type Json = Record<string, unknown>;

/** The first volume of a Google Books `volumes?q=isbn:…` answer. */
export function fromGoogleBooks(json: unknown, isbn: string): Prefill | null {
  const info = ((json as Json)?.items as Json[] | undefined)?.[0]?.volumeInfo as Json | undefined;
  const title = text(info?.title);
  if (!info || !title) return null;
  const images = info.imageLinks as Json | undefined;
  const thumb = text(images?.thumbnail) ?? text(images?.smallThumbnail);
  return {
    title,
    authors: Array.isArray(info.authors) ? info.authors.filter((a): a is string => typeof a === "string" && a.trim() !== "") : undefined,
    publisher: text(info.publisher),
    publishedYear: year(info.publishedDate),
    pages: positive(info.pageCount),
    isbn,
    language: typeof info.language === "string" && /^[a-z]{2,3}$/.test(info.language) ? info.language : undefined,
    // A bigger, flat version of the thumbnail, over https.
    coverUrl: thumb?.replace(/^http:/, "https:").replace(/&edge=curl/, "").replace(/zoom=\d/, "zoom=2"),
    description: plain(text(info.description)),
  };
}

/** Open Library's `api/books?bibkeys=ISBN:…&jscmd=data` answer. */
export function fromOpenLibrary(json: unknown, isbn: string): Prefill | null {
  const book = (json as Json)?.[`ISBN:${isbn}`] as Json | undefined;
  const title = text(book?.title);
  if (!book || !title) return null;
  const names = (list: unknown) =>
    Array.isArray(list) ? list.map((x) => text((x as Json)?.name)).filter((n): n is string => Boolean(n)) : [];
  const cover = book.cover as Json | undefined;
  return {
    title,
    authors: names(book.authors).length ? names(book.authors) : undefined,
    publisher: names(book.publishers)[0],
    publishedYear: year(book.publish_date),
    pages: positive(book.number_of_pages),
    isbn,
    coverUrl: text(cover?.large) ?? text(cover?.medium),
  };
}
