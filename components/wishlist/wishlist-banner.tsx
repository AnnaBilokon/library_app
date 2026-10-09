"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Gift, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { markBought, removeFromWishlist } from "@/app/actions/wishlist";
import { Button } from "@/components/ui/button";
import { todayLocal } from "@/lib/dates";

/** Top of a wishlist book's page: makes clear it isn't on your shelves, with the wishlist actions. */
export function WishlistBanner({ bookId }: { bookId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<{ ok: boolean; error?: string }>, message: string, then?: () => void) =>
    startTransition(async () => {
      const r = await action();
      if (!r.ok) {
        toast.error(r.error ?? "Couldn't save.");
        return;
      }
      toast.success(message);
      then?.();
    });

  return (
    <div role="note" className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl bg-highlight px-4 py-3 text-highlight-foreground">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Gift className="size-4 shrink-0" aria-hidden />
        On your wishlist, not on your shelves yet.
      </p>
      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
        <Button size="sm" className="rounded-full" disabled={pending} onClick={() => run(() => markBought(bookId, todayLocal()), "On your shelves now")}>
          <ShoppingBag aria-hidden />
          Bought it!
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="rounded-full hover:bg-black/10"
          disabled={pending}
          onClick={() => run(() => removeFromWishlist(bookId), "Removed from the wishlist", () => router.push("/wishlist"))}
        >
          Remove from wishlist
        </Button>
        <Link href="/wishlist" className="text-sm font-medium underline underline-offset-4">
          Open the wishlist
        </Link>
      </div>
    </div>
  );
}
