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
  return info ? googleVolume(info, isbn) : null;
}

function googleVolume(info: Json, isbn: string | undefined): (Prefill & { title: string }) | null {
  const title = text(info.title);
  if (!title) return null;
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

/** A book found by searching online: the details it fills in, and where they came from. */
export interface OnlineBook extends Prefill {
  title: string;
  /** Unique among the results (the source's own id for the volume or edition). */
  key: string;
  site: "Google Books" | "Open Library";
}

/** The ISBN-13 among a Google volume's identifiers, or its ISBN-10 converted. */
function googleIsbn(ids: unknown): string | undefined {
  const list = Array.isArray(ids) ? (ids as Json[]) : [];
  const pick = (type: string) => list.find((x) => x?.type === type)?.identifier;
  const raw = text(pick("ISBN_13")) ?? text(pick("ISBN_10"));
  return raw ? (normalizeIsbn(raw) ?? undefined) : undefined;
}

/** Every volume of a Google Books `volumes?q=…` answer. */
export function fromGoogleBooksSearch(json: unknown): OnlineBook[] {
  const items = (json as Json)?.items;
  if (!Array.isArray(items)) return [];
  return items.flatMap((item: Json) => {
    const info = item?.volumeInfo as Json | undefined;
    const book = info && googleVolume(info, googleIsbn(info.industryIdentifiers));
    const id = text(item.id);
    return book && id ? [{ ...book, key: `google:${id}`, site: "Google Books" as const }] : [];
  });
}

/** Open Library's three-letter language codes, for the languages books here come in. */
const MARC_LANGUAGES: Record<string, string> = {
  ukr: "uk", eng: "en", swe: "sv", dut: "nl", pol: "pl", ger: "de", fre: "fr", spa: "es", ita: "it", jpn: "ja", rus: "ru",
};

/**
 * Open Library's `search.json` answer, asked for with `fields=…,editions,editions.…`: each work
 * comes with its best-matching edition, whose publisher, year and ISBN belong to one real book
 * (the work's own lists mix every edition's).
 */
export function fromOpenLibrarySearch(json: unknown): OnlineBook[] {
  const docs = (json as Json)?.docs;
  if (!Array.isArray(docs)) return [];
  return docs.flatMap((doc: Json) => {
    const edition = ((doc?.editions as Json | undefined)?.docs as Json[] | undefined)?.[0] ?? {};
    const title = text(edition.title) ?? text(doc?.title);
    const key = text(edition.key) ?? text(doc?.key);
    if (!title || !key) return [];
    const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim()) : []);
    const isbns = list(edition.isbn).flatMap((raw) => normalizeIsbn(raw) ?? []);
    const languages = list(edition.language);
    const cover = positive(edition.cover_i) ?? positive(doc.cover_i);
    const authors = list(doc.author_name);
    return [
      {
        title,
        authors: authors.length ? authors : undefined,
        publisher: list(edition.publisher)[0],
        publishedYear: year(list(edition.publish_date)[0]),
        // Editions here don't carry a page count; the work's median across its editions is close.
        pages: positive(doc.number_of_pages_median),
        isbn: isbns[0],
        // Only when it's a single language: a list means a bilingual or mixed record.
        language: languages.length === 1 ? MARC_LANGUAGES[languages[0]] : undefined,
        coverUrl: cover ? `https://covers.openlibrary.org/b/id/${cover}-L.jpg` : undefined,
        key: `openlibrary:${key}`,
        site: "Open Library" as const,
      },
    ];
  });
}
