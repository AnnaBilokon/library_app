import "server-only";
import type { ActionResult } from "@/app/actions/books";
import { decodeHtml, FetchError, safeFetch } from "@/lib/net/safe-fetch";
import { parseBookPage, type Prefill } from "./parse";

/** Reads book details from a publisher's or shop's page (one book). No book API involved. */
export async function readBookPage(url: string): Promise<ActionResult<Prefill & { site: string }>> {
  try {
    const page = await safeFetch(url, { accept: "text/html,application/xhtml+xml", maxBytes: 6 * 1024 * 1024 });
    if (!/html/i.test(page.contentType)) return { ok: false, error: "That link isn't a web page." };
    const data = parseBookPage(decodeHtml(page.body, page.contentType), page.url);
    if (!data.title && !data.isbn) return { ok: false, error: "Couldn't find book details on that page. Is it the page of one book?" };
    return { ok: true, data: { ...data, site: new URL(page.url).hostname.replace(/^www\./, "") } };
  } catch (e) {
    if (e instanceof FetchError) {
      if (e.status === 403 || e.status === 429 || e.status === 503) {
        return { ok: false, error: "This site blocks automatic reading. Try the publisher's own site, or fill in by hand." };
      }
      return { ok: false, error: e.message };
    }
    return { ok: false, error: "Something went wrong reading that page." };
  }
}
