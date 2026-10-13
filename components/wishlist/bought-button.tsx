"use client";

import { useState } from "react";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * "Bought it!" asks what you paid (prefilled with the expected price), so Stats can show how much
 * you saved. Skipping is fine.
 */
export function BoughtButton({
  expected,
  currency,
  onConfirm,
  size = "xs",
  disabled,
  label = "Bought it!",
}: {
  expected?: number;
  currency: string;
  onConfirm: (paid: number | null) => void;
  size?: "xs" | "sm";
  disabled?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [paid, setPaid] = useState(expected !== undefined ? String(expected) : "");
  const value = paid.trim() === "" ? null : Number(paid);
  const invalid = value !== null && (!Number.isFinite(value) || value < 0);
  const done = (p: number | null) => {
    setOpen(false);
    onConfirm(p);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button size={size} className="rounded-full" disabled={disabled} />}>
        <ShoppingBag aria-hidden />
        {label}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!invalid) done(value);
          }}
        >
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            What did you pay? ({currency})
            <Input type="number" inputMode="decimal" step="0.01" min={0} value={paid} onChange={(e) => setPaid(e.target.value)} aria-invalid={invalid || undefined} className="h-10" autoFocus />
          </label>
          {expected !== undefined && <p className="-mt-1 text-xs text-muted-foreground">You expected {expected} {currency}.</p>}
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" className="rounded-full px-4" disabled={invalid}>
              Save
            </Button>
            <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => done(null)}>
              Skip
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
