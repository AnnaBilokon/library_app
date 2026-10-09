"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isActive, NAV_ITEMS } from "./nav-items";

const DESKTOP_ITEMS = NAV_ITEMS.filter((i) => i.href !== "/settings");

/** Text navigation in the top bar (desktop). Settings lives in the account menu. */
export function MainNav() {
  return (
    <nav aria-label="Main" className="hidden md:block">
      {/* The current path is only known at request time on dynamic routes, so the
          prerendered version shows no active link and the highlight streams in. */}
      <Suspense fallback={<Links pathname={null} />}>
        <ActiveLinks />
      </Suspense>
    </nav>
  );
}

function ActiveLinks() {
  return <Links pathname={usePathname()} />;
}

function Links({ pathname }: { pathname: string | null }) {
  return (
    <ul className="flex items-center gap-1">
      {DESKTOP_ITEMS.map(({ href, label }) => {
        const active = pathname !== null && isActive(href, pathname);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative inline-flex h-9 items-center rounded-full px-3.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                active && "bg-highlight text-highlight-foreground hover:text-highlight-foreground",
              )}
            >
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
