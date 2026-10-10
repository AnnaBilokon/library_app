"use client";

import { useEffect } from "react";

/** The same open book with a dot as the logo (components/layout/logo.tsx), with fixed colours. */
function iconSvg(tile: string, book: string, spine: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="${tile}"/><g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M16 10.4c-2.9-1.5-6.6-1.8-9.6-.9v12.8c3-.8 6.7-.5 9.6 1.1" stroke="${book}" stroke-width="1.9"/><path d="M16 10.4c2.9-1.5 6.6-1.8 9.6-.9v12.8c-3-.8-6.7-.5-9.6 1.1" stroke="${book}" stroke-width="1.9"/><path d="M16 11.2v12" stroke="${spine}" stroke-width="1.5"/></g><circle cx="16" cy="9.6" r="2.4" fill="${book}"/></svg>`;
}

/**
 * Turns any CSS colour (including var() and color-mix()) into #rrggbb by painting one pixel:
 * the favicon is a separate image, so it can't read the page's CSS variables itself.
 */
function toHex(css: string, ctx: CanvasRenderingContext2D, probe: HTMLElement): string {
  probe.style.color = css;
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = getComputedStyle(probe).color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Keeps the browser tab icon in the logo's colours for the palette and mode you've chosen in the
 * app (not just your computer's light/dark setting). app/icon.svg is the starting icon until this
 * runs, and the one used where scripts don't run.
 */
export function TabIcon() {
  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    const probe = document.createElement("span");
    probe.hidden = true;
    document.body.append(probe);

    const update = () => {
      const color = (token: string) => toHex(`var(${token})`, ctx, probe);
      const href = `data:image/svg+xml,${encodeURIComponent(iconSvg(color("--logo-tile"), color("--logo-book"), color("--logo-spine")))}`;
      // Next adds <link rel="icon" href="/icon.svg">; point every icon link at the coloured one.
      const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')];
      if (links.length === 0) {
        const link = document.createElement("link");
        link.rel = "icon";
        document.head.append(link);
        links.push(link);
      }
      // Only touch links that differ, so this doesn't keep re-triggering the head observer.
      for (const link of links) {
        if (link.href === href) continue;
        link.type = "image/svg+xml";
        link.href = href;
      }
    };

    update();
    // Theme (class on <html>) and palette (data-palette on <html>) changes repaint it.
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-palette"] });
    // Next may put its plain /icon.svg link back (e.g. after navigating): recolour it.
    const head = new MutationObserver(update);
    head.observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ["href"] });
    return () => {
      observer.disconnect();
      head.disconnect();
      probe.remove();
    };
  }, []);
  return null;
}
