"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createHabit, updateHabit } from "@/app/actions/habits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Habit } from "@/lib/habits";
import { cn } from "@/lib/utils";

/** Start a habit, or change one: name, how often, how long, and which books it's about. */
export function HabitForm({ habit, genres, onDone }: { habit?: Habit; genres: string[]; onDone?: () => void }) {
  const [name, setName] = useState(habit?.name ?? "Non-fiction");
  const [perWeek, setPerWeek] = useState(habit?.sessionsPerWeek ?? 3);
  const [minutes, setMinutes] = useState(String(habit?.minMinutes ?? 15));
  const [picked, setPicked] = useState<string[]>(habit?.genres ?? (genres.includes("Non-fiction") ? ["Non-fiction"] : []));
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const input = { name, sessionsPerWeek: perWeek, minMinutes: Number(minutes), genres: picked, bookId: habit?.bookId ?? null };
      const r = habit ? await updateHabit(habit.id, input) : await createHabit(input);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(habit ? "Saved" : `Habit started: ${name}. You've got this!`);
      onDone?.();
    });

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Name
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className="h-10" />
      </label>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Times a week</span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Times a week">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={perWeek === n}
              onClick={() => setPerWeek(n)}
              className={cn("size-10 rounded-full text-sm font-semibold ring-1 ring-border tabular-nums hover:bg-muted", perWeek === n && "bg-primary text-primary-foreground ring-primary hover:bg-primary")}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <label className="flex w-40 flex-col gap-1.5 text-sm font-medium">
        At least (minutes)
        <Input type="number" inputMode="numeric" min={1} max={600} value={minutes} onChange={(e) => setMinutes(e.target.value)} className="h-10" />
      </label>
      {genres.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">
            Which books <span className="font-normal text-muted-foreground">(genres; none picked = any book)</span>
          </span>
          <div className="flex flex-wrap gap-1.5">
            {genres.map((g) => {
              const on = picked.includes(g);
              return (
                <button
                  key={g}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPicked(on ? picked.filter((x) => x !== g) : [...picked, g])}
                  className={cn("h-8 rounded-full px-3 text-sm ring-1 ring-border hover:bg-muted", on && "bg-primary text-primary-foreground ring-primary hover:bg-primary")}
                >
                  {g}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <Button type="submit" className="w-fit rounded-full px-6" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {habit ? "Save" : "Start the habit"}
      </Button>
    </form>
  );
}
