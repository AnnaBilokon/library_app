import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "./page-header";

/** Placeholder for pages built in later phases, so the navigation already works. */
export function ComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <main className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 md:p-6">
      <PageHeader title={title} />
      <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-6">
        <p className="text-sm text-muted-foreground">{text}</p>
        <Link href="/library" className={buttonVariants({ variant: "outline" })}>
          Browse the library
        </Link>
      </div>
    </main>
  );
}
