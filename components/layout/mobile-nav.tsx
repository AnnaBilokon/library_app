"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isActive, NAV_ITEMS } from "./nav-items";

/** Bottom tab bar for phones (hidden from the md breakpoint up). */
export function MobileNav() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
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
    <ul className="grid grid-cols-5">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname !== null && isActive(href, pathname);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                active && "text-foreground",
              )}
            >
              <span className={cn("grid h-7 w-12 place-items-center rounded-full", active && "bg-highlight text-highlight-foreground")}>
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
