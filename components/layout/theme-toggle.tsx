"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PALETTES, type PaletteId } from "@/lib/palettes";
import { usePalette } from "./use-palette";

export const THEMES = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

export function Swatches({ colors, className = "" }: { colors: readonly string[]; className?: string }) {
  return (
    <span aria-hidden className={`flex -space-x-1 ${className}`}>
      {colors.map((c) => (
        <span key={c} className="size-3.5 rounded-full ring-2 ring-popover" style={{ backgroundColor: c }} />
      ))}
    </span>
  );
}

/** Light/dark mode and colour palette, in one menu. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [palette, setPalette] = usePalette();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="rounded-full" aria-label="Theme and colours" />}>
        {/* Both icons are rendered; CSS shows the right one, so there's no flicker before hydration. */}
        <Sun className="dark:hidden" aria-hidden />
        <Moon className="hidden dark:block" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Mode</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={(v) => setTheme(String(v))}>
            {THEMES.map(({ value, label, icon: Icon }) => (
              <DropdownMenuRadioItem key={value} value={value}>
                <Icon aria-hidden />
                {label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Colours</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={palette ?? ""} onValueChange={(v) => setPalette(v as PaletteId)}>
            {PALETTES.map((p) => (
              <DropdownMenuRadioItem key={p.id} value={p.id} closeOnClick={false}>
                <Swatches colors={p.swatches} />
                {p.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
