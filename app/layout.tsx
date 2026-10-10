import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Literata } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { TabIcon } from "@/components/layout/tab-icon";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { paletteScript } from "@/lib/palettes";
import "./globals.css";

const sans = Geist({ variable: "--font-sans", subsets: ["latin", "cyrillic"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin", "cyrillic"] });
// A typeface designed for reading books; used for headings and book titles.
// Italic too: the logo's P is set in Literata italic.
const serif = Literata({ variable: "--font-serif", subsets: ["latin", "cyrillic"], style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: { default: "Punkt", template: "%s · Punkt" },
  description: "Punkt: my personal book library",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0b09" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // next-themes sets the "dark" class on <html> before React loads, so the server HTML
    // and the browser differ on purpose; suppressHydrationWarning silences that one warning.
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${mono.variable} ${serif.variable} antialiased`}>
      <head>
        {/* Applies the saved colour palette before the first paint (same idea as next-themes). */}
        <script dangerouslySetInnerHTML={{ __html: paletteScript }} />
      </head>
      <body className="min-h-svh">
        <ThemeProvider>
          <NuqsAdapter>
            <TooltipProvider>
              {children}
              <Toaster richColors closeButton />
              <TabIcon />
            </TooltipProvider>
          </NuqsAdapter>
        </ThemeProvider>
      </body>
    </html>
  );
}
