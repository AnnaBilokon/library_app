import { LogoMark, Wordmark } from "@/components/layout/logo";

/** The centred logo, a line under it, and the page's card: shared by the sign-in pages. */
export function AuthShell({ subtitle, children }: { subtitle: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <LogoMark className="size-14" />
          <h1>
            <Wordmark className="text-4xl" />
          </h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {children}
      </div>
    </main>
  );
}

/** A quiet link under a card, e.g. "No account? Create one". */
export const authLinkClass = "font-medium text-foreground underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none";
