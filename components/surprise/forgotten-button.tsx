"use client";

import { useOptimistic, useTransition } from "react";
import { PackageOpen } from "lucide-react";
import { toast } from "sonner";
import { setForgotten } from "@/app/actions/books";
import { Button } from "@/components/ui/button";
import type { Book } from "@/lib/types";

/** Book page: put the book in the Forgotten box (for "Surprise me"), or take it out. */
export function ForgottenButton({ book }: { book: Book }) {
  const [, startTransition] = useTransition();
  const [inBox, setInBox] = useOptimistic(book.forgotten);
  if (book.wanted || book.soldAt || book.status === "reading") return null;
  const toggle = () =>
    startTransition(async () => {
      setInBox(!inBox);
      const r = await setForgotten(book.id, !inBox);
      if (!r.ok) toast.error(r.error);
      else toast.success(inBox ? "Taken out of the Forgotten box" : "In the Forgotten box. Surprise me can pick it now");
    });
  return (
    <Button variant={inBox ? "secondary" : "outline"} className="h-9 rounded-full px-4" aria-pressed={inBox} onClick={toggle}>
      <PackageOpen aria-hidden />
      {inBox ? "In Forgotten box" : "Forgotten box"}
    </Button>
  );
}
