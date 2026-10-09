"use client";

import { useId, useState, useTransition } from "react";
import { BookCheck, Loader2, NotebookPen, Pencil, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { setBookStatus, setReview, updateProgress } from "@/app/actions/books";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { progressInfo } from "@/lib/books/progress";
import { openReading } from "@/lib/books/reading-logic";
import { todayLocal } from "@/lib/dates";
import { progressSchema, type ProgressInput as Progress } from "@/lib/schemas";
import type { Book, Reading } from "@/lib/types";
import { cn } from "@/lib/utils";
import { RatingStars } from "./rating-stars";

// ───────────────────────── page / % input ─────────────────────────

export interface ProgressDraft {
  mode: "page" | "percent";
  value: string;
}

export function draftFrom(reading: Reading | undefined, hasPages: boolean): ProgressDraft {
  if (reading?.progressPercent !== undefined) return { mode: "percent", value: String(reading.progressPercent) };
  if (reading?.progressPage !== undefined) return { mode: "page", value: String(reading.progressPage) };
  return { mode: hasPages ? "page" : "percent", value: "" };
}

/** Empty → null (no progress); otherwise a validated page or percentage. */
export function parseDraft(draft: ProgressDraft): { ok: true; progress: Progress | null } | { ok: false; error: string } {
  if (draft.value.trim() === "") return { ok: true, progress: null };
  const r = progressSchema.safeParse({ mode: draft.mode, value: Number(draft.value.replace(",", ".")) });
  return r.success ? { ok: true, progress: r.data } : { ok: false, error: r.error.issues[0]?.message ?? "Check the number." };
}

/** A number with a Page / % switch. */
export function ProgressField({
  draft,
  onChange,
  totalPages,
  label,
}: {
  draft: ProgressDraft;
  onChange: (d: ProgressDraft) => void;
  totalPages?: number;
  label: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          max={draft.mode === "percent" ? 100 : undefined}
          value={draft.value}
          onChange={(e) => onChange({ ...draft, value: e.target.value })}
          className="h-10 w-28 bg-background"
        />
        <div role="radiogroup" aria-label="Track by" className="flex rounded-full bg-muted p-1">
          {(["page", "percent"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={draft.mode === mode}
              onClick={() => onChange({ mode, value: "" })}
              className={cn(
                "h-8 rounded-full px-3 text-sm font-medium text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                draft.mode === mode && "bg-background text-foreground shadow-sm",
              )}
            >
              {mode === "page" ? "Page" : "%"}
            </button>
          ))}
        </div>
        {draft.mode === "page" && totalPages && <span className="text-sm text-muted-foreground">of {totalPages}</span>}
      </div>
    </div>
  );
}

export function ProgressBar({ percent, className }: { percent?: number; className?: string }) {
  if (percent === undefined) return null;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label="Reading progress"
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div className="h-full rounded-full bg-primary transition-[width] dark:bg-highlight" style={{ width: `${percent}%` }} />
    </div>
  );
}

// ───────────────────────── progress panel ─────────────────────────

/** Where you are in the book you're reading: a bar plus a quick page / % update. */
export function ProgressPanel({ book }: { book: Book }) {
  const open = openReading(book.readings);
  const info = progressInfo(open, book.pages);
  const [draft, setDraft] = useState<ProgressDraft>(() => draftFrom(open, Boolean(book.pages)));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    const parsed = parseDraft(draft);
    if (!parsed.ok || !parsed.progress) {
      setError(parsed.ok ? "Enter a page or a percentage." : parsed.error);
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await updateProgress(book.id, parsed.progress, todayLocal());
      if (r.ok) toast.success("Progress saved");
      else toast.error(r.error);
    });
  };

  return (
    <section aria-labelledby="progress-title" className="flex flex-col gap-4 rounded-2xl bg-accent/70 p-5 dark:bg-accent/60">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="progress-title" className="font-heading text-xl font-semibold text-heading">
          Progress
        </h2>
        <span className="text-sm text-muted-foreground">{info?.label ?? "Not logged yet"}</span>
      </div>
      <ProgressBar percent={info?.percent ?? 0} className="h-2.5 bg-background" />
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <ProgressField draft={draft} onChange={setDraft} totalPages={book.pages} label="I'm at" />
        <Button type="submit" className="h-10 rounded-full px-5" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Save
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {!book.pages && draft.mode === "page" && (
        <p className="text-xs text-muted-foreground">Add the page count (Edit) to also see a percentage.</p>
      )}
    </section>
  );
}

// ───────────────────────── did not finish ─────────────────────────

/** Asks where you stopped and why, then marks the book "did not finish". */
export function DnfDialog({ book, open, onOpenChange, onDone }: { book: Book; open: boolean; onOpenChange: (o: boolean) => void; onDone?: () => void }) {
  const current = openReading(book.readings);
  const [draft, setDraft] = useState<ProgressDraft>(() => draftFrom(current, Boolean(book.pages)));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const reasonId = useId();

  const save = () => {
    const parsed = parseDraft(draft);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    startTransition(async () => {
      const r = await setBookStatus(book.id, "abandoned", todayLocal(), { progress: parsed.progress, reason });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Marked as did not finish");
      onOpenChange(false);
      onDone?.();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Did not finish</DialogTitle>
          <DialogDescription>Where did you stop, and why? Both are optional, and help when you come back to it later.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <ProgressField draft={draft} onChange={setDraft} totalPages={book.pages} label="Stopped at" />
          <div className="flex flex-col gap-1.5">
            <label htmlFor={reasonId} className="text-sm font-medium">
              Why I stopped
            </label>
            <Textarea
              id={reasonId}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Too slow, not in the mood, didn't like the translation…"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────── re-reads ─────────────────────────

export function timesReadLabel(n: number): string | null {
  if (n === 0) return null;
  if (n === 1) return "Read once";
  if (n === 2) return "Read twice";
  return `Read ${n} times`;
}

/** "Read 3 times" plus a button to start another reading of a book you've finished or stopped. */
export function RereadControls({ book }: { book: Book }) {
  const [pending, startTransition] = useTransition();
  const label = timesReadLabel(book.timesRead);
  const canReread = book.status === "finished" || book.status === "abandoned";
  if (!label && !canReread) return null;

  const start = () =>
    startTransition(async () => {
      const r = await setBookStatus(book.id, "reading", todayLocal());
      if (r.ok) toast.success(book.timesRead > 0 ? "Re-read started today" : "Started today");
      else toast.error(r.error);
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {label && (
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-highlight px-3 text-xs font-semibold text-highlight-foreground">
          <BookCheck className="size-3.5" aria-hidden />
          {label}
        </span>
      )}
      {canReread && (
        <Button variant="ghost" size="sm" className="rounded-full" onClick={start} disabled={pending}>
          <RotateCcw aria-hidden />
          {book.status === "abandoned" ? "Try again" : "Start a re-read"}
        </Button>
      )}
    </div>
  );
}

// ───────────────────────── review ─────────────────────────

/** Your own review of the book, separate from notes. */
export function ReviewSection({ book }: { book: Book }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(book.review ?? "");
  const [pending, startTransition] = useTransition();
  const fieldId = useId();

  const save = () =>
    startTransition(async () => {
      const r = await setReview(book.id, text);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(text.trim() ? "Review saved" : "Review removed");
      setEditing(false);
    });

  return (
    <section aria-labelledby="review-title" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="review-title" className="font-heading text-2xl font-semibold text-heading">
          My review
        </h2>
        {!editing && book.review && (
          <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setEditing(true)}>
            <NotebookPen aria-hidden />
            Edit
          </Button>
        )}
      </div>
      {editing ? (
        <div className="flex flex-col gap-3">
          <label htmlFor={fieldId} className="sr-only">
            My review
          </label>
          <Textarea
            id={fieldId}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            autoFocus
            placeholder="What did you think? What stayed with you?"
            className="font-heading text-base leading-relaxed"
          />
          <div className="flex gap-2">
            <Button className="rounded-full" onClick={save} disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              Save review
            </Button>
            <Button
              variant="ghost"
              className="rounded-full"
              onClick={() => {
                setText(book.review ?? "");
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : book.review ? (
        <blockquote className="border-l-4 border-primary pl-5 font-heading text-lg leading-relaxed whitespace-pre-wrap dark:border-highlight">
          {book.review}
        </blockquote>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex items-center gap-2 rounded-2xl border border-dashed px-5 py-6 text-left text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <NotebookPen className="size-4" aria-hidden />
          Write your review
        </button>
      )}
    </section>
  );
}

// ───────────────────────── shelf progress ─────────────────────────

/** Under each book on the Reading now shelf: the bar (empty until you log progress) and a quick update. */
export function ShelfProgress({ book }: { book: Book }) {
  const open = openReading(book.readings);
  const info = progressInfo(open, book.pages);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [draft, setDraft] = useState<ProgressDraft>(() => draftFrom(open, Boolean(book.pages)));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    const parsed = parseDraft(draft);
    if (!parsed.ok || !parsed.progress) {
      setError(parsed.ok ? "Enter a page or a percentage." : parsed.error);
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await updateProgress(book.id, parsed.progress, todayLocal());
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Progress saved");
      setPopoverOpen(false);
    });
  };

  return (
    <div className="mt-2 flex flex-col gap-1.5 px-0.5">
      <ProgressBar percent={info?.percent ?? 0} className="h-2 bg-background" />
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-xs text-muted-foreground tabular-nums">
          {info ? (info.percent !== undefined ? `${info.percent}%` : info.label) : "No progress yet"}
        </span>
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger
            render={
              <button
                type="button"
                aria-label={`Update progress for ${book.title}`}
                className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium text-primary ring-1 ring-border hover:bg-background focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none dark:text-highlight"
              />
            }
          >
            <Pencil className="size-3" aria-hidden />
            {info ? "Update" : "Add"}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72">
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <p className="truncate font-heading text-sm font-semibold">{book.title}</p>
              <ProgressField draft={draft} onChange={setDraft} totalPages={book.pages} label="I'm at" />
              {error && (
                <p role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" size="sm" className="self-start rounded-full px-4" disabled={pending}>
                {pending && <Loader2 className="animate-spin" aria-hidden />}
                Save
              </Button>
            </form>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

// ───────────────────────── finished ─────────────────────────

/** Asks for the dates and your rating when you mark a book finished. */
export function FinishDialog({ book, open, onOpenChange }: { book: Book; open: boolean; onOpenChange: (o: boolean) => void }) {
  const current = openReading(book.readings);
  const [startedAt, setStartedAt] = useState(current?.startedAt ?? "");
  const [finishedAt, setFinishedAt] = useState(() => todayLocal());
  const [rating, setRatingValue] = useState<number | null>(book.rating ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const startId = useId();
  const endId = useId();

  const save = () => {
    if (startedAt && finishedAt && finishedAt < startedAt) {
      setError("Can't finish before you started.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await setBookStatus(book.id, "finished", todayLocal(), { startedAt, finishedAt, rating });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(book.timesRead > 0 ? "Finished again!" : "Finished!");
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Finished “{book.title}”</DialogTitle>
          <DialogDescription>When did you read it, and how was it?</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label htmlFor={startId} className="flex flex-col gap-1.5 text-sm font-medium">
              Started
              <Input id={startId} type="date" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} className="h-10" />
            </label>
            <label htmlFor={endId} className="flex flex-col gap-1.5 text-sm font-medium">
              Finished
              <Input
                id={endId}
                type="date"
                value={finishedAt}
                max={todayLocal()}
                onChange={(e) => setFinishedAt(e.target.value)}
                aria-invalid={Boolean(error) || undefined}
                className="h-10"
              />
            </label>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">My rating</span>
            <RatingStars value={rating} onChange={setRatingValue} size="lg" />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || !finishedAt}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────── description ─────────────────────────

/** "About the book": the description, folded to a few lines when it's long. */
export function DescriptionSection({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 420 || text.split("\n\n").length > 3;
  return (
    <section aria-labelledby="about-title" className="flex flex-col gap-3">
      <h2 id="about-title" className="font-heading text-2xl font-semibold text-heading">
        About the book
      </h2>
      <div className={cn("flex flex-col gap-3 leading-relaxed", long && !expanded && "line-clamp-5")}>
        {text.split("\n\n").map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="w-fit text-sm font-medium text-primary underline-offset-4 hover:underline dark:text-highlight"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </section>
  );
}
