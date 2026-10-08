import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
      <h1 className="font-heading text-xl font-semibold">Not found</h1>
      <p className="text-sm text-muted-foreground">This book or page doesn&apos;t exist, or it was removed.</p>
      <Link href="/library" className={buttonVariants()}>
        Back to the library
      </Link>
    </main>
  );
}
