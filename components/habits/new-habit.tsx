"use client";

import { useState } from "react";
import { Plus, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HabitForm } from "./habit-form";

/** Start a habit: open straight away when you have none, behind a button otherwise. */
export function NewHabit({ genres, first }: { genres: string[]; first: boolean }) {
  const [open, setOpen] = useState(first);
  if (!open)
    return (
      <Button variant="outline" className="w-fit rounded-full" onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        Start another habit
      </Button>
    );
  return (
    <section className="flex flex-col gap-5 rounded-3xl bg-card p-5 ring-1 ring-border/60 md:p-7">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 font-heading text-xl font-semibold text-heading">
          <Sprout className="size-5" aria-hidden />
          {first ? "Build a reading habit" : "Another habit"}
        </h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          Little and often: a few short sessions a week. Log them in one tap on the Dashboard, fill the week&apos;s circles, keep the streak going and collect badges.
        </p>
      </div>
      <HabitForm genres={genres} onDone={() => setOpen(false)} />
    </section>
  );
}
