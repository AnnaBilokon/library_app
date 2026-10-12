import type { MetadataRoute } from "next";

/**
 * Makes P·unkt installable: its own icon on the phone's home screen, opening full screen like an
 * app. Long-press the icon for the shortcuts.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "P·unkt — my library",
    short_name: "Punkt",
    description: "My personal book library: reading, wishlist, series and habits.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // The default look (pollen, dark), so the splash screen matches the first page.
    background_color: "#0f151b",
    theme_color: "#0f151b",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Reading habits", short_name: "Habits", url: "/habits", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Add a book", short_name: "Add", url: "/books/new", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Wishlist", url: "/wishlist", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
