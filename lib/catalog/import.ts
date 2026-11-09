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

/**
 * Swedish summaries come from Bokinfo (the book trade's database) with the source at the end:
 * "…i nytappning.[Bokinfo]." It isn't part of the text.
 */
const withoutBokinfoTag = (s: string | undefined) => text(s?.replace(/\s*\[Bokinfo\]\.?$/i, ""));

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
    description: withoutBokinfoTag(plain(text(info.description))),
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
  site: "Google Books" | "Open Library" | "LIBRIS";
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

/** The three-letter (MARC) language codes Open Library and LIBRIS use, for the languages books here come in. */
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

/** Printed books. LIBRIS also lists articles, films, recordings, e-books and talking books. */
const LIBRIS_BOOK_TYPES = new Set(["book", "text"]);

/** A LIBRIS field: a string or a list of them. Empty strings are left out. */
const librisList = (v: unknown) =>
  (Array.isArray(v) ? v : [v]).filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim());

/**
 * LIBRIS follows text in another script with its Latin transliteration in ’…’: "Інтернат : роман
 * ’Internat : roman’". Only a quote opening after a space and closing at the very end counts, so
 * an apostrophe ("Don’t") stays.
 */
const withoutTransliteration = (s: string) => s.replace(/\s+’[^’]*’$/, "").trim();

/** "Bergström, Gunilla, 1942-2021" (or "Gunilla Bergström") as "Gunilla Bergström". */
function librisAuthor(raw: string): string | undefined {
  const name = withoutTransliteration(raw).replace(/,\s*\d{4}-(\d{4})?$/, "");
  const parts = name.split(",").map((p) => p.trim());
  return text(parts.length === 2 ? `${parts[1]} ${parts[0]}` : name);
}

/**
 * The publisher from "Stockholm : Rabén & Sjögren", or from a ["Lidingö", "Astrid Lindgren AB"]
 * list, where it comes after the place.
 */
function librisPublisher(v: unknown): string | undefined {
  const entries = librisList(v).map(withoutTransliteration);
  const afterPlace = entries.find((s) => s.includes(" : "))?.split(" : ").at(-1);
  return text((afterPlace ?? entries.at(-1))?.replace(/^\[|\]$/g, ""));
}

/** The words of a LIBRIS XL label: a string, or a list of them. */
const xlLabel = (v: unknown) => librisList((v as Json | undefined)?.label).join(" ");

/**
 * The description and page count from LIBRIS XL's `find.jsonld?identifiedBy.value=<isbn>` answer.
 * Its record for a Swedish book usually comes from Bokinfo (the book trade's database): a page
 * count ("248 s.", "45 sidor", "33 onumrerade sidor") and often the publisher's summary, the same
 * text Google Books shows, but without needing a key.
 */
export function fromLibrisXl(json: unknown, isbn: string): Pick<Prefill, "description" | "pages"> {
  const items = (json as Json)?.items;
  const item = (Array.isArray(items) ? (items as Json[]) : []).find((i) =>
    (Array.isArray(i?.identifiedBy) ? (i.identifiedBy as Json[]) : []).some((id) => normalizeIsbn(String(id?.value ?? "")) === isbn),
  );
  if (!item) return {};
  const summaries = Array.isArray(item.summary) ? item.summary : [];
  const description = withoutBokinfoTag(text(summaries.map(xlLabel).join("\n\n")));
  const extents = Array.isArray(item.extent) ? item.extent : [];
  const pages = extents
    .map((e) => /\[?(\d+)\]?\s*(?:onumrerade\s+)?(?:s\.|sidor|sid\.?|p\.|pages)/i.exec(xlLabel(e)))
    .map((m) => (m ? Number(m[1]) : undefined))
    .find((n) => n && n > 0);
  return { description, pages };
}

/**
 * LIBRIS Xsearch's `xsearch?query=…&format=json` answer: Sweden's national library catalog, so
 * nearly every book published in Sweden (children's books too), plus books in other languages
 * that Swedish libraries hold, Ukrainian ones in Cyrillic among them. No covers or page counts.
 */
export function fromLibrisSearch(json: unknown): OnlineBook[] {
  const list = ((json as Json)?.xsearch as Json | undefined)?.list;
  if (!Array.isArray(list)) return [];
  return list.flatMap((r: Json) => {
    const id = text(r?.identifier);
    const full = librisList(r?.title)[0];
    if (!id || !full || !LIBRIS_BOOK_TYPES.has(String(r.type))) return [];
    // "Pippi Långstrump : en bok" → the title before the subtitle.
    const title = text(withoutTransliteration(full).split(" : ")[0].replace(/\s*\/.*$/, ""));
    if (!title) return [];
    const authors = librisList(r.creator).flatMap((a) => librisAuthor(a) ?? []);
    const languages = librisList(r.language);
    return [
      {
        title,
        authors: authors.length ? authors : undefined,
        publisher: librisPublisher(r.publisher),
        publishedYear: librisList(r.date).map(year).find(Boolean),
        isbn: librisList(r.isbn).flatMap((raw) => normalizeIsbn(raw) ?? [])[0],
        // Only when it's a single language: a list means a bilingual or mixed record.
        language: languages.length === 1 ? MARC_LANGUAGES[languages[0]] : undefined,
        key: `libris:${id}`,
        site: "LIBRIS" as const,
      },
    ];
  });
}
