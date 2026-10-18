import sharp from "sharp";

/**
 * Catalog covers are stored at most this wide. The app never shows a cover wider than 288 px
 * (a book's page), so even a 3× phone screen gets all the detail it can show.
 */
export const COVER_WIDTH = 800;

/**
 * A cover at most COVER_WIDTH wide as WebP: about a third of the size of shops' originals. The
 * original is kept when it's already smaller (or can't be read as an image).
 */
export async function shrinkCover(body: Uint8Array, type: string): Promise<{ body: Uint8Array; type: string }> {
  try {
    const out = await sharp(body).rotate().resize({ width: COVER_WIDTH, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    return out.length < body.length ? { body: new Uint8Array(out), type: "image/webp" } : { body, type };
  } catch {
    return { body, type };
  }
}
