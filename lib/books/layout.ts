/** Library page display choices, remembered in cookies so the server renders them right away. */
export type LibraryLayout = "grid" | "table";
export const LAYOUT_COOKIE = "library_view";
export const COLUMNS_COOKIE = "library_columns";

/** Table columns hidden until you turn them on. */
export const DEFAULT_COLUMNS: Record<string, boolean> = {
  pages: false,
  format: false,
  rating: false,
  owned: false,
  lastFinishedAt: false,
};

export function parseColumns(raw: string | undefined): Record<string, boolean> {
  if (!raw) return DEFAULT_COLUMNS;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw));
    if (parsed && typeof parsed === "object" && Object.values(parsed).every((v) => typeof v === "boolean")) {
      return parsed as Record<string, boolean>;
    }
  } catch {
    // Corrupted cookie: fall back to the defaults.
  }
  return DEFAULT_COLUMNS;
}
