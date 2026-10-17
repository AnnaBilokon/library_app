"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteReleaseSource, saveReleaseSource, type SourceInput } from "@/app/actions/releases";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/books/labels";
import type { ReleaseSource } from "@/lib/data/releases";

const blank: SourceInput = { url: "", label: "", kind: "new", pages: 2, pattern: "" };

/** The publishers' pages the check reads: add, change and remove them. */
export function SourcesEditor({ sources }: { sources: ReleaseSource[] }) {
  return (
    <details className="group rounded-2xl ring-1 ring-border">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-medium [&::-webkit-details-marker]:hidden">
        Sources ({sources.length})
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="flex flex-col gap-4 border-t p-4">
        <p className="text-sm text-muted-foreground">
          A publisher&apos;s or shop&apos;s listing page: new releases or coming soon. &quot;Pages&quot; is how many pages of it a check reads; &quot;book links start
          with&quot; is found automatically on the first check.
        </p>
        <ul className="flex flex-col gap-4">
          {sources.map((s) => (
            <SourceRow key={`${s.id}-${s.pattern ?? ""}`} source={s} />
          ))}
        </ul>
        <SourceRow />
      </div>
    </details>
  );
}

function SourceRow({ source }: { source?: ReleaseSource }) {
  const router = useRouter();
  const [value, setValue] = useState<SourceInput>(
    source ? { url: source.url, label: source.label, kind: source.kind, pages: source.pages, pattern: source.pattern ?? "" } : blank,
  );
  const [pending, start] = useTransition();
  const set = (patch: Partial<SourceInput>) => setValue((v) => ({ ...v, ...patch }));
  const dirty = source
    ? value.url !== source.url || value.label !== source.label || value.kind !== source.kind || value.pages !== source.pages || (value.pattern ?? "") !== (source.pattern ?? "")
    : Boolean(value.url && value.label);

  const save = () =>
    start(async () => {
      const r = await saveReleaseSource(source?.id ?? null, value);
      if (!r.ok) return void toast.error(r.error);
      toast.success(source ? "Saved" : "Source added");
      if (!source) setValue(blank);
      router.refresh();
    });
  const remove = () =>
    start(async () => {
      const r = await deleteReleaseSource(source!.id);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Source removed; the books found there stay in the catalog");
      router.refresh();
    });

  return (
    <li className={source ? "flex flex-col gap-2" : "flex list-none flex-col gap-2 rounded-xl bg-muted/50 p-3"}>
      {!source && <p className="text-sm font-medium">Add a source</p>}
      <div className="grid gap-2 sm:grid-cols-[12rem_1fr]">
        <Input value={value.label} onChange={(e) => set({ label: e.target.value })} placeholder="Name, e.g. Віват · Новинки" aria-label="Name" className="h-9" />
        <Input value={value.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://…" aria-label="Listing page" type="url" className="h-9" />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select value={value.kind} onChange={(e) => set({ kind: e.target.value as "new" | "coming" })} aria-label="Kind" className="h-8 rounded-lg border border-input bg-background px-2">
          <option value="new">New</option>
          <option value="coming">Coming soon</option>
        </select>
        <select value={value.pages} onChange={(e) => set({ pages: Number(e.target.value) })} aria-label="Pages to read" className="h-8 rounded-lg border border-input bg-background px-2">
          {[1, 2, 3, 5, 10, 20].map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "page" : "pages"}
            </option>
          ))}
        </select>
        <Input
          value={value.pattern ?? ""}
          onChange={(e) => set({ pattern: e.target.value })}
          placeholder="book links start with (auto)"
          aria-label="Book links start with"
          className="h-8 w-52 font-mono text-xs"
        />
        {source?.lastCheckedAt && <span className="text-xs text-muted-foreground">checked {formatDate(source.lastCheckedAt.slice(0, 10))}</span>}
        <span className="ml-auto flex gap-1.5">
          {source && (
            <Button type="button" variant="ghost" size="sm" className="rounded-full text-destructive" onClick={remove} disabled={pending} aria-label={`Remove ${source.label}`}>
              <Trash2 aria-hidden />
            </Button>
          )}
          <Button type="button" size="sm" variant={source ? "outline" : "default"} className="rounded-full" onClick={save} disabled={pending || !dirty}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : !source && <Plus aria-hidden />}
            {source ? "Save" : "Add"}
          </Button>
        </span>
      </div>
    </li>
  );
}
