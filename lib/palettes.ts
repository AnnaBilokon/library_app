/** Colour palettes. The CSS for each lives in app/globals.css under [data-palette="<id>"]. */
export const PALETTES = [
  { id: "plum", name: "Plum & sky", swatches: ["#070707", "#28231c", "#513b3c", "#655356", "#c1eeff"] },
  { id: "rose", name: "Smoky rose & teal", swatches: ["#785964", "#82a7a6", "#000000", "#9ed0e6", "#b796ac"] },
  { id: "pollen", name: "Pollen & charcoal", swatches: ["#bdd9bf", "#2e4052", "#ffc857", "#ffffff", "#412234"] },
  { id: "tea", name: "Tea green", swatches: ["#bdd9bf", "#8fb996", "#4f7d5c", "#1f3a2b", "#f7f9f2"] },
] as const;

export type PaletteId = (typeof PALETTES)[number]["id"];
/** What you see before choosing one (with dark mode, see ThemeProvider). */
export const DEFAULT_PALETTE: PaletteId = "pollen";
export const PALETTE_STORAGE_KEY = "palette";

/**
 * Runs in <head> before the page paints, so a saved palette never flashes the default first.
 * <html data-palette> always names the palette ("plum" has no CSS of its own: it's the :root base).
 */
export const paletteScript = `(function(){try{var ids=${JSON.stringify(PALETTES.map((p) => p.id))};var p=localStorage.getItem(${JSON.stringify(PALETTE_STORAGE_KEY)});document.documentElement.setAttribute("data-palette",ids.indexOf(p)>=0?p:${JSON.stringify(DEFAULT_PALETTE)})}catch(e){}})()`;
