import Link from "next/link";
import { Layers, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";

/** Switch between the series tracker and the author collections (two pages, one place in the nav). */
export function CollectionTabs({ current }: { current: "series" | "authors" }) {
  const tabs = [
    { id: "series", href: "/series", label: "Series", icon: Layers },
    { id: "authors", href: "/series/authors", label: "Authors", icon: UsersRound },
  ] as const;
  return (
    <nav aria-label="Collections" className="flex w-fit rounded-full bg-muted p-1">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          aria-current={current === t.id ? "page" : undefined}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            current === t.id && "bg-background text-foreground shadow-sm",
          )}
        >
          <t.icon className="size-4" aria-hidden />
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
