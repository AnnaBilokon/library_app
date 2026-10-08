"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { isActive, NAV_ITEMS } from "./nav-items";

/** Desktop navigation. On phones the bottom MobileNav is used instead. */
export function AppSidebar({ footer }: { footer?: React.ReactNode }) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <BookOpen className="size-4" aria-hidden />
              </span>
              <span className="font-heading text-base font-semibold">My library</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            {/* See MobileNav: the active item is highlighted once the path is known. */}
            <Suspense fallback={<NavMenu pathname={null} />}>
              <ActiveNavMenu />
            </Suspense>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      {footer && <SidebarFooter>{footer}</SidebarFooter>}
      <SidebarRail />
    </Sidebar>
  );
}

function ActiveNavMenu() {
  return <NavMenu pathname={usePathname()} />;
}

function NavMenu({ pathname }: { pathname: string | null }) {
  return (
    <SidebarMenu>
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname !== null && isActive(href, pathname);
        return (
          <SidebarMenuItem key={href}>
            <SidebarMenuButton isActive={active} tooltip={label} render={<Link href={href} aria-current={active ? "page" : undefined} />}>
              <Icon aria-hidden />
              <span>{label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
