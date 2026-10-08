"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { THEMES } from "./theme-toggle";

const subscribe = () => () => {};

export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  // The saved theme is only known in the browser; render nothing selected on the server.
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  return (
    <ToggleGroup
      variant="outline"
      value={mounted ? [theme ?? "system"] : []}
      onValueChange={(v) => v[0] && setTheme(v[0])}
      aria-label="Theme"
    >
      {THEMES.map(({ value, label, icon: Icon }) => (
        <ToggleGroupItem key={value} value={value} className="gap-2 px-3">
          <Icon aria-hidden />
          {label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
