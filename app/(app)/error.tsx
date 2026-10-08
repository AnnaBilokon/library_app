"use client"; // Error boundaries must be Client Components.

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shown instead of a page when something on it throws, so you never get a blank screen. */
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="size-6" aria-hidden />
      </span>
      <h1 className="font-heading text-xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        This page couldn&apos;t be loaded. It may be a temporary connection problem.
        {error.digest && <span className="mt-1 block font-mono text-xs">Error id: {error.digest}</span>}
      </p>
      <Button onClick={retry}>Try again</Button>
    </main>
  );
}
