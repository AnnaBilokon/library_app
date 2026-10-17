import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { COVER_WIDTH, shrinkCover } from "./shrink";

/** A noisy JPEG (noise doesn't compress, like a real photo cover). */
async function jpeg(width: number, height: number): Promise<Uint8Array> {
  const pixels = Buffer.alloc(width * height * 3);
  for (let i = 0; i < pixels.length; i++) pixels[i] = (i * 2654435761) % 251;
  return new Uint8Array(await sharp(pixels, { raw: { width, height, channels: 3 } }).jpeg({ quality: 92 }).toBuffer());
}

describe("shrinking catalog covers", () => {
  it("makes a big cover 800 px wide WebP, keeping its proportions", async () => {
    const original = await jpeg(1600, 2400);
    const small = await shrinkCover(original, "image/jpeg");
    const meta = await sharp(small.body).metadata();
    expect(small.type).toBe("image/webp");
    expect(meta.width).toBe(COVER_WIDTH);
    expect(meta.height).toBe(1200);
    expect(small.body.length).toBeLessThan(original.length);
  });

  it("never makes a cover wider, and keeps the original when it's already smaller", async () => {
    const tiny = new Uint8Array(await sharp({ create: { width: 200, height: 300, channels: 3, background: "#fff" } }).png().toBuffer());
    const kept = await shrinkCover(tiny, "image/png");
    expect((await sharp(kept.body).metadata()).width).toBeLessThanOrEqual(200);
    expect(kept.body.length).toBeLessThanOrEqual(tiny.length);
  });

  it("keeps anything that isn't an image as it is", async () => {
    const junk = new Uint8Array([1, 2, 3, 4]);
    expect(await shrinkCover(junk, "image/jpeg")).toEqual({ body: junk, type: "image/jpeg" });
  });
});
