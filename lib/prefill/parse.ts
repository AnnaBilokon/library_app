/**
 * Reads book details from a publisher's or shop's book page (HTML), without any book API.
 * Pure function, no network: the Server Action fetches the page and passes the HTML here.
 *
 * Sources, most reliable first (the first non-empty value per field wins):
 *  1. schema.org "Book" in JSON-LD (e.g. Лабораторія)
 *  2. the page's embedded app data (__NEXT_DATA__, e.g. Старий Лев)
 *  3. schema.org "Product" in JSON-LD (e.g. Віват)
 *  4. the visible spec table: "Автор / Видавництво / Кількість сторінок / Рік видання / ISBN"
 *  5. OpenGraph share tags (og:title, og:image)
 */
import { normalizeIsbn } from "@/lib/isbn";

export interface Prefill {
  title?: string;
  authors?: string[];
  publisher?: string;
  publishedYear?: number;
  pages?: number;
  isbn?: string;
  language?: string;
  coverUrl?: string;
  /** The publisher's blurb, as plain text with blank lines between paragraphs. */
  description?: string;
}

type Json = Record<string, unknown>;

const LANGUAGE_NAMES: Record<string, string> = {
  українська: "uk",
  англійська: "en",
  шведська: "sv",
  польська: "pl",
  німецька: "de",
  французька: "fr",
  іспанська: "es",
  італійська: "it",
  японська: "ja",
  російська: "ru",
};

// ───────────────────────── small helpers ─────────────────────────

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", laquo: "«", raquo: "»", mdash: "—", ndash: "–", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

const clean = (v: unknown): string | undefined => {
  if (typeof v !== "string" && typeof v !== "number") return undefined;
  const s = decodeEntities(String(v)).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return s || undefined;
};

const MARKETING = /(купити|замовляйте|замовити|інтернет-(магазин|книгарн)|доставка|вигідні ціни)/i;

/** HTML or text → plain text with paragraphs; shop marketing blurbs are rejected. */
export function cleanDescription(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const text = decodeEntities(
    v
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6])>/gi, "\n\n")
      .replace(/<[^>]+>/g, ""),
  )
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
  if (text.length < 60 || MARKETING.test(text.slice(0, 200))) return undefined;
  return text.length > 6000 ? `${text.slice(0, 6000).replace(/\s+\S*$/, "")}…` : text;
}

const toInt = (v: unknown, min: number, max: number): number | undefined => {
  const m = String(v ?? "").match(/\d{1,4}/);
  const n = m ? Number(m[0]) : NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : undefined;
};

const yearOf = (v: unknown) => toInt(String(v ?? "").match(/(1[5-9]|20)\d{2}/)?.[0], 1500, 2100);

/** The first valid ISBN found in the text (pages often list paper and e-book ISBNs together). */
function findIsbn(text: unknown): string | undefined {
  const s = String(text ?? "");
  for (const m of s.matchAll(/(?:97[89][\s-]?)?(?:\d[\s-]?){9}[\dXx]/g)) {
    const isbn = normalizeIsbn(m[0]);
    if (isbn) return isbn;
  }
  return undefined;
}

const names = (v: unknown): string[] => {
  const list = Array.isArray(v) ? v : v ? [v] : [];
  return list
    .flatMap((a) => (typeof a === "string" ? a.split(/,|;| та | і (?=[А-ЯІЇЄҐA-Z])/) : [clean((a as Json)?.name)]))
    .map((a) => clean(a))
    .filter((a): a is string => Boolean(a));
};

const absolute = (src: unknown, base: string): string | undefined => {
  const s = clean(Array.isArray(src) ? src[0] : typeof src === "object" && src ? (src as Json).url ?? (src as Json).contentUrl : src);
  if (!s) return undefined;
  try {
    const u = new URL(s, base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : undefined;
  } catch {
    return undefined;
  }
};

const languageCode = (v: unknown): string | undefined => {
  const s = clean(v)?.toLowerCase();
  if (!s) return undefined;
  if (/^[a-z]{2,3}(-|$)/.test(s)) return s.slice(0, 2);
  return LANGUAGE_NAMES[s.split(/[\s,]/)[0]];
};

/** "📗 Книга «Назва» у Vivat" → "Назва"; "Назва купити у ВСЛ" → "Назва"; "Назва | Shop" → "Назва". */
export function cleanTitle(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let t = raw.replace(/[\p{Extended_Pictographic}️]/gu, "").trim();
  const quoted = t.match(/«([^»]+)»/);
  // JS \b only understands Latin letters, so Cyrillic words are matched with explicit spaces.
  if (quoted && /^(книга|книжка|роман)\s/i.test(t)) t = quoted[1];
  t = t
    .split(/\s[|–—]\s|\s-\s(?=купити|buy)/i)[0]
    .replace(/\s+(купити|придбати|замовити)(\s.*)?$/i, "")
    .replace(/^(книга|книжка)\s+/i, "")
    .replace(/^«(.+)»$/, "$1")
    .trim();
  return t || undefined;
}

// ───────────────────────── extractors ─────────────────────────

function jsonLdNodes(html: string): Json[] {
  const nodes: Json[] = [];
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data: unknown = JSON.parse(m[1].trim());
      const queue = Array.isArray(data) ? [...data] : [data];
      while (queue.length) {
        const n = queue.shift();
        if (!n || typeof n !== "object") continue;
        const node = n as Json;
        nodes.push(node);
        if (Array.isArray(node["@graph"])) queue.push(...node["@graph"]);
      }
    } catch {
      // Broken JSON-LD happens; skip that block.
    }
  }
  return nodes;
}

const hasType = (node: Json, type: string) => [node["@type"]].flat().some((t) => String(t).toLowerCase() === type.toLowerCase());

function fromBookLd(node: Json, base: string): Prefill {
  return {
    title: clean(node.name),
    authors: names(node.author),
    publisher: clean((node.publisher as Json)?.name ?? node.publisher),
    publishedYear: yearOf(node.datePublished ?? node.copyrightYear),
    pages: toInt(node.numberOfPages, 1, 20000),
    isbn: findIsbn(node.isbn) ?? findIsbn(node.gtin13),
    language: languageCode(node.inLanguage),
    coverUrl: absolute(node.image, base),
    description: cleanDescription(node.description),
  };
}

function fromProductLd(node: Json, base: string): Prefill {
  const props = Array.isArray(node.additionalProperty) ? (node.additionalProperty as Json[]) : [];
  const prop = (re: RegExp) => props.find((p) => re.test(String(p.name ?? "")))?.value;
  return {
    title: cleanTitle(clean(node.name)),
    authors: names(node.author ?? prop(/автор/i)),
    publisher: clean(prop(/видавництво|publisher/i)) ?? clean((node.brand as Json)?.name ?? node.brand),
    publishedYear: yearOf(prop(/рік|year/i)),
    pages: toInt(prop(/сторін|pages/i), 1, 20000),
    isbn: findIsbn(node.isbn) ?? findIsbn(node.gtin13) ?? findIsbn(node.mpn) ?? findIsbn(prop(/isbn/i)),
    coverUrl: absolute(node.image, base),
    description: cleanDescription(node.description),
  };
}

/** Next.js sites embed the page data as JSON; find the object for this page's slug. */
function fromNextData(html: string, url: string): Prefill {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return {};
  let data: unknown;
  try {
    data = JSON.parse(m[1]);
  } catch {
    return {};
  }
  const slug = new URL(url).pathname.split("/").filter(Boolean).at(-1);
  let found: Json | undefined;
  const walk = (o: unknown, depth: number) => {
    if (found || !o || typeof o !== "object" || depth > 12) return;
    const node = o as Json;
    if (node.slug === slug && ("isbn" in node || "qty_pages" in node || "pages" in node)) {
      found = node;
      return;
    }
    for (const v of Object.values(node)) walk(v, depth + 1);
  };
  walk(data, 0);
  if (!found) return {};
  return {
    title: clean(found.name ?? found.title),
    authors: names(found.author ?? found.authors),
    publisher: clean((found.edition as Json)?.name ?? (found.publisher as Json)?.name ?? found.publisher),
    publishedYear: yearOf(found.year),
    pages: toInt(found.qty_pages ?? found.pages, 1, 20000),
    isbn: findIsbn(found.isbn),
    description: cleanDescription(found.description ?? found.annotation),
  };
}

/** The visible "label: value" spec table, as text lines. */
function fromSpecTable(html: string): Prefill {
  const lines = decodeEntities(
    html
      .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, "")
      .replace(/<[^>]+>/g, "\n"),
  )
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  // Labels like "Автори" also appear in site menus, so prefer the match closest to the
  // spec table (found by its most distinctive labels).
  const anchor = lines.findIndex((l) => /^(кількість сторінок|isbn|рік видання|видавництво)\s*:?/i.test(l));
  const value = (label: RegExp): string | undefined => {
    const candidates: { index: number; value: string | undefined }[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const inline = line.match(new RegExp(`^(?:${label.source})\\s*:\\s*(.+)$`, "i"));
      if (inline) candidates.push({ index: i, value: inline[1] });
      else if (new RegExp(`^(?:${label.source})\\s*:?$`, "i").test(line)) candidates.push({ index: i, value: lines[i + 1] });
    }
    if (anchor < 0) return candidates[0]?.value;
    return candidates.sort((a, b) => Math.abs(a.index - anchor) - Math.abs(b.index - anchor))[0]?.value;
  };

  // The blurb under an "Анотація" / "Опис" heading, up to the next section.
  const start = lines.findIndex((l) => /^(анотація|опис|про книжку|про книгу)\s*:?$/i.test(l));
  const blurb: string[] = [];
  for (let i = start + 1; start >= 0 && i < lines.length && blurb.length < 30; i++) {
    if (/^(характеристики|відгуки|рецензії|схожі|вам також|дивитися|читати|коментарі|доставка|оплата)/i.test(lines[i])) break;
    blurb.push(lines[i]);
  }

  return {
    description: cleanDescription(blurb.join("\n\n")),
    authors: names(value(/автор(?:\(ка\)|ка|и|\(и\))?/)),
    publisher: clean(value(/видавництво|видавець/)),
    publishedYear: yearOf(value(/рік видання|рік/)),
    pages: toInt(value(/кількість сторінок|к-сть сторінок|сторінок|обсяг/), 1, 20000),
    isbn: findIsbn(value(/isbn/)),
    language: languageCode(value(/мова(?: видання)?/)),
  };
}

function fromMeta(html: string, base: string): Prefill {
  const meta = (name: string) => {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`, "i");
    const tag = html.match(re)?.[0];
    return tag ? clean(tag.match(/content=["']([^"']*)["']/i)?.[1]) : undefined;
  };
  const image = absolute(meta("og:image"), base);
  return {
    title: cleanTitle(meta("og:title") ?? clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])),
    authors: names(meta("book:author")),
    isbn: findIsbn(meta("book:isbn")) ?? findIsbn(image?.split("/").at(-1)),
    coverUrl: image,
    description: cleanDescription(meta("og:description")),
  };
}

/** Combine sources: for each field, the first source that has a value wins. */
function merge(...sources: Prefill[]): Prefill {
  const out: Prefill = {};
  for (const s of sources) {
    for (const [k, v] of Object.entries(s) as [keyof Prefill, Prefill[keyof Prefill]][]) {
      const empty = v === undefined || (Array.isArray(v) && v.length === 0);
      const filled = out[k] !== undefined;
      if (!empty && !filled) (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}

export function parseBookPage(html: string, url: string): Prefill {
  const nodes = jsonLdNodes(html);
  const book = nodes.find((n) => hasType(n, "Book"));
  const product = nodes.find((n) => hasType(n, "Product"));
  const fromBook = book ? fromBookLd(book, url) : {};
  const fromNext = fromNextData(html, url);
  const fromProduct = product ? fromProductLd(product, url) : {};
  const fromSpecs = fromSpecTable(html);
  const fromOg = fromMeta(html, url);
  const merged = merge(fromBook, fromNext, fromProduct, fromSpecs, fromOg);
  // For the description the visible "Анотація" section beats a Product record: shops often
  // flatten the Product text into one paragraph, while the page keeps the paragraphs.
  const description = fromBook.description ?? fromNext.description ?? fromSpecs.description ?? fromProduct.description ?? fromOg.description;
  return description ? { ...merged, description } : merged;
}
