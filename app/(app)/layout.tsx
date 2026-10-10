import { Suspense } from "react";
import Link from "next/link";
import { CommandMenu } from "@/components/layout/command-menu";
import { MainNav } from "@/components/layout/main-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { requireUser } from "@/lib/auth";
import { getBooks } from "@/lib/data/books";
import { Logo } from "@/components/layout/logo";

/**
 * Shell for every signed-in page. The layout itself is static, so it is prerendered and shows
 * instantly. Only the parts that need the session (account menu, search index, page content)
 * wait for the request, each behind its own <Suspense>.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md supports-backdrop-filter:bg-background/70">
        <div className="mx-auto flex h-16 w-full max-w-screen-2xl items-center gap-4 px-4 md:px-8">
          <Link href="/" aria-label="Punkt, go to the Dashboard" className="rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
            <Logo markClassName="size-8" wordClassName="text-[1.4rem]" />
          </Link>
          <MainNav />
          <div className="ml-auto flex items-center gap-1.5">
            <Suspense fallback={<div className="size-9 md:w-56" />}>
              <SearchIndex />
            </Suspense>
            <ThemeToggle />
            <Suspense fallback={<div className="size-9 rounded-full bg-muted" />}>
              <Account />
            </Suspense>
          </div>
        </div>
      </header>
      <div className="flex-1 pb-20 md:pb-0">{children}</div>
      <MobileNav />
    </div>
  );
}

async function Account() {
  const user = await requireUser();
  return <UserMenu email={user.email} />;
}

async function SearchIndex() {
  const books = await getBooks();
  return <CommandMenu books={books.map(({ id, title, authors, wanted, soldAt }) => ({ id, title, authors, wanted, soldAt }))} />;
}
