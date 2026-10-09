/** Colour palettes. The CSS for each lives in app/globals.css under [data-palette="<id>"]. */
export const PALETTES = [
  { id: "plum", name: "Plum & sky", swatches: ["#070707", "#28231c", "#513b3c", "#655356", "#c1eeff"] },
  { id: "rose", name: "Smoky rose & teal", swatches: ["#785964", "#82a7a6", "#000000", "#9ed0e6", "#b796ac"] },
] as const;

export type PaletteId = (typeof PALETTES)[number]["id"];
export const DEFAULT_PALETTE: PaletteId = "plum";
export const PALETTE_STORAGE_KEY = "palette";

/**
 * Runs in <head> before the page paints, so a saved palette never flashes the default first.
 * The default palette has no attribute; others set data-palette on <html>.
 */
export const paletteScript = `(function(){try{var p=localStorage.getItem(${JSON.stringify(PALETTE_STORAGE_KEY)});if(p&&p!==${JSON.stringify(DEFAULT_PALETTE)})document.documentElement.setAttribute("data-palette",p)}catch(e){}})()`;
