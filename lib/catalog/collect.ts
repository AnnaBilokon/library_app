import { decodeEntities } from "@/lib/prefill/parse";

/**
 * Finding the book links on a publisher's or shop's listing page ("new releases", "coming soon"),
 * across all of its pages. Pure functions; the Server Action does the fetching.
 */

/**
 * Same-site links on a page, absolute, without #fragments, in page order, each once: the page's
 * <a href> links, then links in its embedded data ("url": "…"), where sites that draw their
 * listing with JavaScript (e.g. Старий Лев) keep the book addresses.
 */
export function extractLinks(html: string, pageUrl: string): string[] {
  const base = new URL(pageUrl);
  const seen = new Set<string>();
  const links: string[] = [];
  const add = (raw: string) => {
    let url: URL;
    try {
      url = new URL(raw, base);
    } catch {
      return;
    }
    if (url.host !== base.host || !/^https?:$/.test(url.protocol)) return;
    url.hash = "";
    const href = url.toString();
    if (!seen.has(href)) {
      seen.add(href);
      links.push(href);
    }
  };
  for (const m of html.matchAll(/<a\b[^>]*?\shref\s*=\s*["']([^"']+)["']/gi)) add(decodeEntities(m[1]));
  for (const m of html.matchAll(/"(?:url|href|link)"\s*:\s*"((?:https?:)?\\?\/[^"\s]+)"/gi)) add(m[1].replace(/\\\//g, "/"));
  return links;
}

const PAGE_IN_PATH = /\/(?:page[-/]?)(\d+)\/?$/i;
const PAGE_PARAMS = ["page", "p", "pg", "PAGEN_1"];

/** The listing a page belongs to: its address without "page 2" (path suffix or ?page=). */
export function listingKey(href: string): string {
  const url = new URL(href);
  url.hash = "";
  url.pathname = url.pathname.replace(PAGE_IN_PATH, "").replace(/\/$/, "") || "/";
  for (const p of PAGE_PARAMS) url.searchParams.delete(p);
  url.searchParams.sort();
  return url.toString();
}

/** Another page of the same listing (/page-2, /page/2, ?page=2)? */
export function isPageOf(href: string, listingUrl: string): boolean {
  if (listingKey(href) !== listingKey(listingUrl)) return false;
  const url = new URL(href);
  return PAGE_IN_PATH.test(url.pathname) || PAGE_PARAMS.some((p) => /^\d+$/.test(url.searchParams.get(p) ?? ""));
}

/** A book-link pattern: links whose path starts with `prefix`, optionally with exactly `depth` parts. */
export interface LinkPattern {
  prefix: string;
  depth?: number;
}

const parts = (href: string) => new URL(href).pathname.split("/").filter(Boolean);

export function matchesPattern(href: string, { prefix, depth }: LinkPattern): boolean {
  const path = new URL(href).pathname;
  return path.startsWith(prefix) && path.length > prefix.length && (depth === undefined || parts(href).length === depth);
}

/**
 * Guesses which links are the books: on a listing, the books are the biggest group of links with
 * the same shape (first path part and number of parts, like /product/<name>). Groups that hold
 * the listing itself are its menu (categories, filters), not books. Null when nothing stands out.
 */
export function guessBookPattern(links: string[], listingUrl: string): LinkPattern | null {
  const listing = listingKey(listingUrl);
  const groups = new Map<string, { pattern: LinkPattern; links: Set<string>; menu: boolean }>();
  for (const href of links) {
    const p = parts(href);
    let key: string;
    let pattern: LinkPattern;
    if (p.length >= 2) {
      key = `${p[0]}|${p.length}`;
      pattern = { prefix: `/${p[0]}/`, depth: p.length };
    } else {
      // Top-level pages are books only when many share a first word, like Старий Лев's
      // /knyga-<name>; single words (/news, /shops) are site pages.
      const word = p[0]?.match(/^([a-zЀ-ӿ]{3,})-./i)?.[1];
      if (!word) continue;
      key = `${word}-|1`;
      pattern = { prefix: `/${word}-`, depth: 1 };
    }
    const group = groups.get(key) ?? { pattern, links: new Set(), menu: false };
    group.links.add(listingKey(href));
    if (listingKey(href) === listing || href.startsWith(listing)) group.menu = true;
    groups.set(key, group);
  }
  const best = [...groups.values()].filter((g) => !g.menu && g.links.size >= 3).sort((a, b) => b.links.size - a.links.size)[0];
  return best?.pattern ?? null;
}

/** "/product/" or "/product/…/…" for showing a pattern; parsed back by `parsePattern`. */
export function describePattern({ prefix, depth }: LinkPattern): string {
  const extra = depth === undefined ? 0 : depth - prefix.split("/").filter(Boolean).length;
  return extra > 1 ? `${prefix}${Array(extra).fill("…").join("/")}` : prefix;
}

/** What the admin typed in "Book links start with": a path prefix (any depth). */
export function parsePattern(text: string): LinkPattern | null {
  const t = text.trim().replace(/….*$/, "");
  if (!t) return null;
  let prefix = t;
  try {
    if (/^https?:\/\//i.test(t)) prefix = new URL(t).pathname;
  } catch {
    return null;
  }
  return { prefix: prefix.startsWith("/") ? prefix : `/${prefix}` };
}

/**
 * The listing's other pages linked from this one: numbered links (/page-2, ?page=2) and the
 * standard <link rel="next"> that sites with a "Show more" button often have instead.
 */
export function pageLinks(html: string, pageUrl: string, listingUrl: string): string[] {
  const found = extractLinks(html, pageUrl).filter((l) => isPageOf(l, listingUrl));
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    if (!/\brel\s*=\s*["']?next\b/i.test(m[0])) continue;
    const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(m[0])?.[1];
    if (!href) continue;
    try {
      const url = new URL(decodeEntities(href), pageUrl);
      if (listingKey(url.toString()) === listingKey(listingUrl) && !found.includes(url.toString())) found.push(url.toString());
    } catch {
      // not a usable link
    }
  }
  return found;
}

export interface WalkResult {
  links: string[];
  pattern: LinkPattern;
  pages: number;
  /** Why it stopped before the last page, if it did. */
  note?: string;
}

/**
 * Reads a listing and its further pages (at most `maxPages`) and collects the book links, using
 * `pattern` or one guessed from the first page. `fetchPage` returns a page's HTML; when it throws
 * on the first page the error goes to the caller, later failures just stop the walk.
 */
export async function walkListing(
  listingUrl: string,
  pattern: LinkPattern | null,
  fetchPage: (url: string) => Promise<string>,
  { maxPages = 20, pauseMs = 300 }: { maxPages?: number; pauseMs?: number } = {},
): Promise<WalkResult | null> {
  const queue = [listingUrl];
  const visited = new Set<string>();
  const links: string[] = [];
  let note: string | undefined;

  while (queue.length && visited.size < maxPages) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);
    let html: string;
    try {
      html = await fetchPage(url);
    } catch (e) {
      if (visited.size === 1) throw e;
      note = `Stopped at page ${visited.size}: ${e instanceof Error ? e.message : "couldn't read it"}`;
      break;
    }
    const onPage = extractLinks(html, url);
    pattern ??= guessBookPattern(onPage, listingUrl);
    if (!pattern) return null;
    for (const l of onPage) if (matchesPattern(l, pattern) && !links.includes(l)) links.push(l);
    for (const next of pageLinks(html, url, listingUrl)) if (!visited.has(next) && !queue.includes(next)) queue.push(next);
    // Be gentle with the site.
    if (queue.length && pauseMs) await new Promise((r) => setTimeout(r, pauseMs));
  }
  if (!note && queue.length) note = `Read the first ${maxPages} pages; the listing has more.`;
  return { links, pattern: pattern!, pages: visited.size, note };
}
