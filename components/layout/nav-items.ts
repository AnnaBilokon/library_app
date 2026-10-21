import { HandCoins, Heart, Layers, LayoutDashboard, Library, Settings } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/library", label: "Library", icon: Library },
  { href: "/series", label: "Series", icon: Layers },
  { href: "/wishlist", label: "Wishlist", icon: Heart },
  { href: "/sell", label: "Sell", icon: HandCoins },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

/** "/books/123" and "/battle" count as being inside the Library, "/stats" as the Dashboard. */
export function isActive(href: string, pathname: string): boolean {
  // Stats is a tab of the Dashboard.
  if (href === "/") return pathname === "/" || pathname.startsWith("/stats");
  // Book Battle lives in the Library (a button at the top).
  if (href === "/library")
    return pathname.startsWith("/library") || pathname.startsWith("/books") || pathname.startsWith("/battle") || pathname.startsWith("/favorites");
  // New releases is reached from the Wishlist.
  if (href === "/wishlist") return pathname.startsWith("/wishlist") || pathname.startsWith("/releases");
  return pathname.startsWith(href);
}
