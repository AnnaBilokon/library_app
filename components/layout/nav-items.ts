import { BarChart3, HandCoins, Heart, Layers, LayoutDashboard, Library, Settings, Swords } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/library", label: "Library", icon: Library },
  { href: "/series", label: "Series", icon: Layers },
  { href: "/wishlist", label: "Wishlist", icon: Heart },
  { href: "/sell", label: "Sell", icon: HandCoins },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/battle", label: "Battle", icon: Swords },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

/** "/books/123" counts as being inside the Library. */
export function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/library") return pathname.startsWith("/library") || pathname.startsWith("/books");
  return pathname.startsWith(href);
}
