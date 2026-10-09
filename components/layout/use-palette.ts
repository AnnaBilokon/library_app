"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_PALETTE, PALETTE_STORAGE_KEY, PALETTES, type PaletteId } from "@/lib/palettes";

const EVENT = "palettechange";

function read(): PaletteId {
  const value = document.documentElement.getAttribute("data-palette");
  return PALETTES.some((p) => p.id === value) ? (value as PaletteId) : DEFAULT_PALETTE;
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  // Keep other open tabs in sync.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== PALETTE_STORAGE_KEY) return;
    apply((e.newValue as PaletteId | null) ?? DEFAULT_PALETTE, false);
  };
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function apply(id: PaletteId, persist = true) {
  if (id === DEFAULT_PALETTE) document.documentElement.removeAttribute("data-palette");
  else document.documentElement.setAttribute("data-palette", id);
  if (persist) {
    try {
      localStorage.setItem(PALETTE_STORAGE_KEY, id);
    } catch {
      // Private mode: the choice just won't be remembered.
    }
  }
  window.dispatchEvent(new Event(EVENT));
}

/**
 * The current palette and a setter. The palette lives on <html data-palette> (set before paint
 * by the inline script in app/layout.tsx), so React reads it from there instead of keeping a copy.
 * On the server it reports null, because the saved choice is only known in the browser.
 */
export function usePalette() {
  const palette = useSyncExternalStore<PaletteId | null>(subscribe, read, () => null);
  return [palette, apply] as const;
}
