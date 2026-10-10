"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isActive, NAV_ITEMS } from "./nav-items";

// Settings is in the account menu, which phones show in the top bar too.
const TAB_ITEMS = NAV_ITEMS.filter((i) => i.href !== "/settings");

/** Bottom tab bar for phones (hidden from the md breakpoint up). */
export function MobileNav() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 bg-background/90 shadow-[0_-10px_30px_-18px_rgb(0_0_0/0.35)] pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {/* The current path is only known at request time on dynamic routes, so the
          prerendered version shows no active tab and the highlight streams in. */}
      <Suspense fallback={<Tabs pathname={null} />}>
        <ActiveTabs />
      </Suspense>
    </nav>
  );
}

function ActiveTabs() {
  return <Tabs pathname={usePathname()} />;
}

function Tabs({ pathname }: { pathname: string | null }) {
  return (
    <ul className="grid grid-cols-7">
      {TAB_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname !== null && isActive(href, pathname);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                active && "text-foreground",
              )}
            >
              <span className={cn("grid h-7 w-10 place-items-center rounded-full", active && "bg-highlight text-highlight-foreground")}>
                <Icon className="size-5" aria-hidden />
              </span>
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
