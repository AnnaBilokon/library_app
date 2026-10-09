import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Fetches a URL the user pasted, without letting it reach private/internal addresses (SSRF).
 * Every redirect hop is checked too. Also enforces a timeout and a maximum size.
 */

export class FetchError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateIp(v6.slice(7));
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb");
}

async function assertPublic(url: URL) {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new FetchError("Only web links (http/https) are supported.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new FetchError("That address isn't allowed.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new FetchError("That address isn't allowed.");
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (addresses.length === 0) throw new FetchError("Couldn't find that website.");
  if (addresses.some(isPrivateIp)) throw new FetchError("That address isn't allowed.");
}

const HEADERS = {
  // Look like a normal browser; many shops reject unknown clients.
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  "Accept-Language": "uk,en;q=0.8",
};

export async function safeFetch(
  input: string,
  { accept, maxBytes, timeoutMs = 12_000 }: { accept: string; maxBytes: number; timeoutMs?: number },
): Promise<{ url: string; contentType: string; body: Uint8Array }> {
  let url = new URL(input);
  const signal = AbortSignal.timeout(timeoutMs);

  for (let hop = 0; hop < 5; hop++) {
    await assertPublic(url);
    const res = await fetch(url, { redirect: "manual", headers: { ...HEADERS, Accept: accept }, signal }).catch((e: unknown) => {
      throw new FetchError(e instanceof Error && e.name === "TimeoutError" ? "The site took too long to answer." : "Couldn't reach that website.");
    });

    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, url);
      continue;
    }
    if (!res.ok) throw new FetchError(`The site answered with an error (HTTP ${res.status}).`, res.status);

    // Read the body in chunks so a huge file can't exhaust memory.
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new FetchError("That page or file is too large.");
      }
      chunks.push(value);
    }
    const body = new Uint8Array(size);
    let offset = 0;
    for (const c of chunks) {
      body.set(c, offset);
      offset += c.byteLength;
    }
    return { url: url.href, contentType: res.headers.get("content-type") ?? "", body };
  }
  throw new FetchError("Too many redirects.");
}

/** Decodes an HTML page, honouring a non-UTF-8 charset if the server declares one. */
export function decodeHtml(body: Uint8Array, contentType: string): string {
  const charset = contentType.match(/charset=([\w-]+)/i)?.[1]?.toLowerCase() ?? "utf-8";
  try {
    return new TextDecoder(charset).decode(body);
  } catch {
    return new TextDecoder("utf-8").decode(body);
  }
}

/** Detects the image type from its first bytes (servers sometimes send the wrong Content-Type). */
export function sniffImageType(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | "image/avif" | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 8) === "ftyp" && /avi[fs]/.test(ascii(8, 12))) return "image/avif";
  return null;
}
