"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addReading, deleteReading, updateReading } from "@/app/actions/books";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/books/labels";
import { readingInputSchema, type ReadingFormValues } from "@/lib/schemas";
import type { Reading } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Reading history as a timeline; each entry can be edited in place, and new readings added. */
export function ReadingHistory({ bookId, readings }: { bookId: string; readings: Reading[] }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-2xl font-semibold text-heading">Reading history</h2>
        {editing !== "new" && (
          <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setEditing("new")}>
            <Plus aria-hidden />
            Add a reading
          </Button>
        )}
      </div>

      {readings.length === 0 && editing !== "new" && (
        <p className="text-sm text-muted-foreground">Not read yet. Set the status to Reading, or add a past reading with its dates.</p>
      )}

      {(readings.length > 0 || editing === "new") && (
        <ol className="flex flex-col gap-5 border-l-2 border-border pl-6">
          {readings.map((r, i) => (
            <li key={r.id} className="relative">
              <Dot active={r.outcome === undefined} />
              {editing === r.id ? (
                <ReadingEditor
                  initial={r}
                  onCancel={() => setEditing(null)}
                  onSave={(values) => updateReading(r.id, values)}
                  onDelete={() => deleteReading(r.id)}
                  onDone={() => setEditing(null)}
                />
              ) : (
                <div className="group flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{readings.length > 1 ? `Reading ${i + 1}` : "Read"}</span>
                    <span className="text-sm text-muted-foreground">{describe(r)}</span>
                    {!r.startedAt && !r.finishedAt && (
                      <button type="button" onClick={() => setEditing(r.id)} className="w-fit text-sm text-primary underline-offset-4 hover:underline dark:text-highlight">
                        Add dates
                      </button>
                    )}
                  </div>
                  <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label="Edit this reading" onClick={() => setEditing(r.id)}>
                    <Pencil aria-hidden />
                  </Button>
                </div>
              )}
            </li>
          ))}
          {editing === "new" && (
            <li className="relative">
              <Dot active />
              <ReadingEditor
                initial={{ outcome: "finished" }}
                onCancel={() => setEditing(null)}
                onSave={(values) => addReading(bookId, values)}
                onDone={() => setEditing(null)}
              />
            </li>
          )}
        </ol>
      )}
    </section>
  );
}

function Dot({ active }: { active?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute top-1.5 -left-[31px] size-3 rounded-full ring-4 ring-background",
        active ? "bg-highlight" : "bg-primary dark:bg-highlight",
      )}
    />
  );
}

type Result = { ok: true } | { ok: false; error: string };

function ReadingEditor({
  initial,
  onSave,
  onDelete,
  onCancel,
  onDone,
}: {
  initial: Partial<Reading>;
  onSave: (values: ReadingFormValues) => Promise<Result>;
  onDelete?: () => Promise<Result>;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [values, setValues] = useState<ReadingFormValues>({
    startedAt: initial.startedAt ?? "",
    finishedAt: initial.finishedAt ?? "",
    outcome: initial.outcome ?? "in-progress",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<Result>, message: string) =>
    startTransition(async () => {
      const r = await action();
      if (r.ok) {
        toast.success(message);
        onDone();
      } else toast.error(r.error);
    });

  const save = () => {
    const parsed = readingInputSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the dates.");
      return;
    }
    setError(null);
    run(() => onSave(values), "Reading saved");
  };

  const set = (patch: Partial<ReadingFormValues>) => setValues((v) => ({ ...v, ...patch }));

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-muted/60 p-4">
      <div role="radiogroup" aria-label="How it ended" className="flex flex-wrap gap-1.5">
        {(
          [
            ["finished", "Finished"],
            ["in-progress", "Still reading"],
            ["abandoned", "Stopped"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={values.outcome === value}
            onClick={() => set({ outcome: value, ...(value === "in-progress" ? { finishedAt: "" } : {}) })}
            className={cn(
              "h-8 rounded-full px-3 text-sm font-medium ring-1 ring-border hover:bg-background focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              values.outcome === value && "bg-primary text-primary-foreground ring-primary hover:bg-primary",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Started
          <Input type="date" value={values.startedAt} onChange={(e) => set({ startedAt: e.target.value })} className="h-10 bg-background" />
        </label>
        {values.outcome !== "in-progress" && (
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {values.outcome === "finished" ? "Finished" : "Stopped"}
            <Input
              type="date"
              value={values.finishedAt}
              onChange={(e) => set({ finishedAt: e.target.value })}
              aria-invalid={Boolean(error) || undefined}
              className="h-10 bg-background"
            />
          </label>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Leave a date empty if you don&apos;t remember it.</p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button className="rounded-full" onClick={save} disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Save
        </Button>
        <Button variant="ghost" className="rounded-full" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        {onDelete && (
          <Button
            variant="ghost"
            className="ml-auto rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => run(onDelete, "Reading deleted")}
            disabled={pending}
          >
            <Trash2 aria-hidden />
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}

function describe(r: Reading): string {
  const outcome = r.outcome === "finished" ? "Finished" : r.outcome === "abandoned" ? "Stopped" : "Reading now";
  if (!r.startedAt && !r.finishedAt) return `${outcome} · dates unknown`;
  const parts = [r.startedAt && `Started ${formatDate(r.startedAt)}`, r.finishedAt && `${outcome.toLowerCase()} ${formatDate(r.finishedAt)}`];
  if (!r.finishedAt && r.outcome === undefined) parts.push("in progress");
  if (r.startedAt && r.finishedAt) {
    const days = Math.round((Date.parse(r.finishedAt) - Date.parse(r.startedAt)) / 86_400_000) + 1;
    parts.push(`${days} ${days === 1 ? "day" : "days"}`);
  }
  return parts.filter(Boolean).join(" · ");
}
