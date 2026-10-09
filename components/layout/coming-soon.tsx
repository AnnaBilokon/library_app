import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "./page-header";

/** Placeholder for pages built in later phases, so the navigation already works. */
export function ComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <main className="mx-auto flex w-full max-w-screen-2xl flex-col gap-8 px-4 pt-6 pb-12 md:px-8 md:pt-10">
      <PageHeader title={title} />
      <div className="flex flex-col items-start gap-4 rounded-3xl bg-accent/70 p-6 md:p-8 dark:bg-accent/60">
        <p className="max-w-prose md:text-lg">{text}</p>
        <Link href="/library" className={buttonVariants({ className: "h-10 rounded-full px-5" })}>
          Browse the library
        </Link>
      </div>
    </main>
  );
}
