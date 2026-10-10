"use client";

import { useTransition } from "react";
import { EyeOff, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { setTracked } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";

type Kind = "series" | "author";

function useTracking(kind: Kind) {
  const [pending, startTransition] = useTransition();
  const run = (name: string, tracked: boolean, undo = true) =>
    startTransition(async () => {
      const r = await setTracked(kind, name, tracked);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(tracked ? `Tracking ${name} again` : `Not tracking ${name}`, undo ? { action: { label: "Undo", onClick: () => run(name, !tracked, false) } } : undefined);
    });
  return { pending, run };
}

/** On a card: stop tracking this series or author (your books keep their details). */
export function StopTrackingButton({ kind, name }: { kind: Kind; name: string }) {
  const { pending, run } = useTracking(kind);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className="rounded-full text-muted-foreground hover:text-foreground"
      disabled={pending}
      onClick={() => run(name, false)}
      aria-label={`Stop tracking ${name}`}
      title="Stop tracking"
    >
      <EyeOff aria-hidden />
    </Button>
  );
}

/** At the bottom of the page: what you've stopped tracking, each with "Track again". */
export function NotTracked({ kind, names }: { kind: Kind; names: string[] }) {
  const { pending, run } = useTracking(kind);
  if (names.length === 0) return null;
  return (
    <details className="group rounded-2xl bg-muted/50 p-4 md:p-5">
      <summary className="cursor-pointer text-sm font-medium">
        Not tracked <span className="text-muted-foreground tabular-nums">({names.length})</span>
      </summary>
      <ul className="mt-3 flex flex-wrap gap-2">
        {names.map((n) => (
          <li key={n}>
            <Button type="button" variant="outline" size="sm" className="rounded-full" disabled={pending} onClick={() => run(n, true, false)}>
              <RotateCcw aria-hidden />
              {n}
              <span className="sr-only">: track again</span>
            </Button>
          </li>
        ))}
      </ul>
    </details>
  );
}
