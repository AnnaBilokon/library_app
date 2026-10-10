"use client";

import { useId, useState, useTransition } from "react";
import { Pencil, Target } from "lucide-react";
import { toast } from "sonner";
import { setCountriesGoal } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCountUp, useInView } from "@/components/dashboard/motion";

/**
 * "Read around the world": a goal for how many countries you'd like to have read authors from
 * (all years), with a bar that fills as you get there.
 */
export function CountriesGoal({ goal, reached }: { goal: number | null; reached: number }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const shown = useCountUp(reached, inView);
  const share = goal ? Math.min(1, reached / goal) : 0;
  return (
    <div ref={ref} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-muted/50 px-4 py-3">
      <Target className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      {goal ? (
        <>
          <p className="text-sm">
            <span className="font-semibold tabular-nums">{shown}</span> of {goal} countries
            {reached >= goal ? " · goal reached! 🎉" : ` · ${goal - reached} to go`}
          </p>
          <div
            role="meter"
            aria-label={`${reached} of ${goal} countries`}
            aria-valuemin={0}
            aria-valuemax={goal}
            aria-valuenow={Math.min(reached, goal)}
            className="h-2 min-w-32 flex-1 overflow-hidden rounded-full bg-background"
          >
            <div className="h-full rounded-full bg-chart-actual transition-[width] duration-1000 ease-out motion-reduce:transition-none" style={{ width: inView ? `${share * 100}%` : "0%" }} />
          </div>
        </>
      ) : (
        <p className="flex-1 text-sm text-muted-foreground">
          {reached} {reached === 1 ? "country" : "countries"} so far. Set a goal to read your way around the world.
        </p>
      )}
      <GoalEditor goal={goal} />
    </div>
  );
}

function GoalEditor({ goal }: { goal: number | null }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(goal ? String(goal) : "25");
  const [pending, startTransition] = useTransition();
  const id = useId();
  const save = (next: number | null) =>
    startTransition(async () => {
      const r = await setCountriesGoal(next);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(next ? `Goal: ${next} countries` : "Countries goal removed");
      setOpen(false);
    });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:underline focus-visible:outline-none"
          />
        }
      >
        <Pencil className="size-3" aria-hidden />
        {goal ? "Change goal" : "Set a goal"}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(value);
            if (Number.isInteger(n) && n >= 1 && n <= 250) save(n);
            else toast.error("Pick a number from 1 to 250.");
          }}
        >
          <label htmlFor={id} className="text-sm font-medium">
            Countries to read authors from
          </label>
          <Input id={id} type="number" min={1} max={250} value={value} onChange={(e) => setValue(e.target.value)} className="h-9" autoFocus />
          <div className="flex gap-2">
            <Button type="submit" size="sm" className="rounded-full" disabled={pending}>
              Save
            </Button>
            {goal && (
              <Button type="button" size="sm" variant="ghost" className="rounded-full" disabled={pending} onClick={() => save(null)}>
                Remove goal
              </Button>
            )}
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
