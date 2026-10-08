import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = { title: "Wishlist" };

export default function WishlistPage() {
  return <ComingSoon title="Wishlist" text="Books you want to buy, with priorities and prices, arrive in Phase 4." />;
}
