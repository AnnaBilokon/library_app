import { Suspense } from "react";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { CommandMenu } from "@/components/layout/command-menu";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { requireUser } from "@/lib/auth";
import { getBooks } from "@/lib/data/books";

/**
 * Shell for every signed-in page. The layout itself is static, so it is prerendered and shows
 * instantly. Only the parts that need the session (user menu, search index, page content)
 * wait for the request, each behind its own <Suspense>.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar
        footer={
          <Suspense>
            <UserMenu />
          </Suspense>
        }
      />
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1 hidden md:inline-flex" />
          <div className="flex-1">
            <Suspense fallback={<SearchPlaceholder />}>
              <SearchIndex />
            </Suspense>
          </div>
          <ThemeToggle />
        </header>
        <div className="flex-1 pb-20 md:pb-0">{children}</div>
      </SidebarInset>
      <MobileNav />
    </SidebarProvider>
  );
}

async function UserMenu() {
  const user = await requireUser();
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <form action={signOut}>
          <SidebarMenuButton type="submit" tooltip="Sign out" className="text-muted-foreground">
            <LogOut aria-hidden />
            <span className="truncate">Sign out ({user.email})</span>
          </SidebarMenuButton>
        </form>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

async function SearchIndex() {
  const books = await getBooks();
  return <CommandMenu books={books.map(({ id, title, authors }) => ({ id, title, authors }))} />;
}

function SearchPlaceholder() {
  return (
    <Button variant="outline" disabled className="h-9 w-full max-w-64 justify-start text-muted-foreground sm:w-64">
      Search…
    </Button>
  );
}
