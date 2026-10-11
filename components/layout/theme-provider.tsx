"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/** System / light / dark (dark until you choose), stored in localStorage, applied before first paint (no flash). */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
