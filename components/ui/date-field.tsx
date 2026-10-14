"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { dmyToIso, isoToDmy } from "@/lib/dates";
import { cn } from "@/lib/utils";

interface DateFieldProps {
  id?: string;
  /** The date as stored: "2026-10-11", or "" for none. */
  value: string;
  onChange: (iso: string) => void;
  onBlur?: () => void;
  min?: string;
  max?: string;
  className?: string;
  /** Extra classes for the text box (the wrapper takes className). */
  inputClassName?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

/**
 * A date you read and type as day.month.year (11.10.2026), whatever language the browser is in;
 * the browser's own date field would show month/day/year in US English. The calendar button opens
 * the browser's date picker. Dots, slashes, dashes or spaces all work when typing.
 */
export function DateField({ id, value, onChange, onBlur, min, max, className, inputClassName, ...aria }: DateFieldProps) {
  // While you type, the text is yours; otherwise it shows the stored date.
  const [draft, setDraft] = useState<string | null>(null);
  const parsed = draft === null ? value : dmyToIso(draft);
  const invalid = parsed === null || (parsed !== "" && ((min && parsed < min) || (max && parsed > max)));

  const type = (text: string) => {
    setDraft(text);
    const iso = dmyToIso(text);
    // A whole, real date (or an empty field) is saved straight away, so submitting works without leaving the field.
    if (iso === "" || (iso && text.trim().length >= 8)) onChange(iso);
  };

  return (
    <div className={cn("relative", className)}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd.mm.yyyy"
        value={draft ?? isoToDmy(value)}
        onChange={(e) => type(e.target.value)}
        onBlur={() => {
          if (draft !== null && dmyToIso(draft) !== null) setDraft(null);
          onBlur?.();
        }}
        aria-invalid={aria["aria-invalid"] || Boolean(invalid) || undefined}
        aria-describedby={aria["aria-describedby"]}
        className={cn(
          "h-10 w-full min-w-0 rounded-lg border border-input bg-transparent py-1 pr-10 pl-3 text-base tabular-nums transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          inputClassName,
        )}
      />
      {/*
        The calendar: a real date input, invisible, lying exactly over the icon. Tapping it is a tap
        on the input itself, so phones (iPhone Safari, the home-screen app, Android) open their own
        picker, which they refuse to do when a script asks. Computers get showPicker() on click.
      */}
      <input
        type="date"
        aria-label="Pick a date from the calendar"
        value={parsed ?? ""}
        min={min}
        max={max}
        onClick={(e) => {
          try {
            e.currentTarget.showPicker();
          } catch {
            // Phones open their picker from the tap itself.
          }
        }}
        onChange={(e) => {
          setDraft(null);
          onChange(e.target.value);
        }}
        // Always invisible (the icon below shows hover and focus); 16px text stops iPhone zooming in.
        className="peer absolute top-1/2 right-1.5 z-10 size-7 -translate-y-1/2 cursor-pointer appearance-none rounded-md border-0 bg-transparent p-0 text-base opacity-0 outline-none [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:size-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
      />
      <span
        className="pointer-events-none absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground peer-hover:bg-muted peer-hover:text-foreground peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50"
        aria-hidden
      >
        <CalendarDays className="size-4" />
      </span>
    </div>
  );
}
