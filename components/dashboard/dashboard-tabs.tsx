import Link from "next/link";
import { BarChart3, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

/** Dashboard and Stats: two pages, one place in the nav (keeps the phone's tab bar short). */
export function DashboardTabs({ current }: { current: "overview" | "stats" }) {
  const tabs = [
    { id: "overview", href: "/", label: "Overview", icon: LayoutDashboard },
    { id: "stats", href: "/stats", label: "Stats", icon: BarChart3 },
  ] as const;
  return (
    <nav aria-label="Dashboard" className="flex w-fit rounded-full bg-muted p-1">
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
