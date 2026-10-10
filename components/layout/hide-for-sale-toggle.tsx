"use client";

import { useId, useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { setHideForSale } from "@/app/actions/settings";
import { Checkbox } from "@/components/ui/checkbox";

/** Settings: hide the books on the sell shelf from the Library (they stay on the Sell page). */
export function HideForSaleToggle({ initial }: { initial: boolean }) {
  const [, startTransition] = useTransition();
  const [hide, setHide] = useOptimistic(initial);
  const id = useId();
  const change = (next: boolean) =>
    startTransition(async () => {
      setHide(next);
      const r = await setHideForSale(next);
      if (!r.ok) toast.error(r.error);
      else toast.success(next ? "Books for sale are hidden from the Library" : "Books for sale show in the Library again");
    });
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
      <Checkbox id={id} checked={hide} onCheckedChange={(c) => change(c === true)} className="mt-0.5" />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">Hide books on the sell shelf from the Library</span>
        <span className="text-sm text-muted-foreground">They stay on the Sell page, and come back to the Library if you choose “Keep it”.</span>
      </span>
    </label>
  );
}
