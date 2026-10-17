"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Sparkles, Square, Tags, X } from "lucide-react";
import { toast } from "sonner";
import { applyTagSuggestions, renameTag, saveTagList, suggestTagList, suggestTagsForBooks } from "@/app/actions/tags";
import { BookCover } from "@/components/books/book-cover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cleanTagList, normalizeTag, TAG_BATCH, TAG_LIST_MAX, type TagSuggestion } from "@/lib/tags/tags";
import { cn } from "@/lib/utils";

export interface TagBook {
  id: string;
  title: string;
  authors: string[];
  coverSrc?: string;
  language?: string;
  tags: string[];
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function TagsManager({ initialList, books }: { initialList: string[]; books: TagBook[] }) {
  const [saved, setSaved] = useState(initialList);
  return (
    <div className="flex flex-col gap-12">
      <TagListEditor saved={saved} onSaved={setSaved} books={books} />
      <TagYourBooks tagList={saved} books={books} />
    </div>
  );
}

// ───────────────────────── Your tag list ─────────────────────────

function TagListEditor({ saved, onSaved, books }: { saved: string[]; onSaved: (list: string[]) => void; books: TagBook[] }) {
  const router = useRouter();
  const [list, setList] = useState(saved);
  const [draft, setDraft] = useState("");
  const [proposed, setProposed] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const dirty = list.join("|") !== saved.join("|");

  // How many of your books carry each tag, and the tags on books that aren't in the list.
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of books) for (const t of new Set(b.tags.map(normalizeTag))) m.set(t, (m.get(t) ?? 0) + 1);
    return m;
  }, [books]);
  const strays = useMemo(() => {
    const listed = new Set(list);
    const seen = new Map<string, string>();
    for (const b of books) for (const t of b.tags) if (!listed.has(t) && !seen.has(t)) seen.set(t, t);
    return [...seen.keys()];
  }, [books, list]);

  const add = (tags: string[]) => setList((l) => cleanTagList([...l, ...tags]));
  const newProposals = proposed.filter((t) => !list.includes(t));

  return (
    <section aria-labelledby="tag-list-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="tag-list-title" className="font-heading text-2xl font-semibold text-heading">
          Your tag list
        </h2>
        <p className="text-muted-foreground">
          Moods and themes in Ukrainian (затишна історія, сильні жінки…). Suggestions only use tags from this list, so they stay consistent and easy to filter. Up to {TAG_LIST_MAX}.
        </p>
      </div>

      <ul className="flex flex-wrap gap-2" aria-label="Tags in your list">
        {list.length === 0 && <li className="text-sm text-muted-foreground">No tags yet. Add some, or let Claude suggest a starting list.</li>}
        {list.map((t) => (
          <li key={t} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-accent pr-1 pl-3 text-sm">
            {t}
            <span className="text-xs text-muted-foreground tabular-nums">{counts.get(t) ?? 0}</span>
            <button
              type="button"
              onClick={() => setList((l) => l.filter((x) => x !== t))}
              className="grid size-6 place-items-center rounded-full hover:bg-background"
              aria-label={`Remove “${t}” from the list`}
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add([draft]);
            setDraft("");
          }}
        >
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a tag" aria-label="New tag" className="h-9 w-56" />
          <Button type="submit" variant="outline" className="h-9 rounded-full" disabled={!draft.trim()}>
            <Plus aria-hidden />
            Add
          </Button>
        </form>
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-full"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await suggestTagList();
              if (!r.ok) return void toast.error(r.error);
              setProposed(r.data);
              if (r.data.every((t) => list.includes(t))) toast.info("Nothing to add: your list already has these.");
            })
          }
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
          Suggest a starting list
        </Button>
      </div>

      {newProposals.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl bg-muted/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Suggested by Claude: tap the ones you want</p>
            <Button type="button" size="sm" variant="secondary" className="rounded-full" onClick={() => add(newProposals)}>
              Add all {newProposals.length}
            </Button>
          </div>
          <ul className="flex flex-wrap gap-2">
            {newProposals.map((t) => (
              <li key={t}>
                <button
                  type="button"
                  onClick={() => add([t])}
                  className="inline-flex h-8 items-center gap-1 rounded-full border border-dashed border-primary/50 px-3 text-sm hover:bg-background"
                >
                  <Plus className="size-3.5" aria-hidden />
                  {t}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {strays.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">On your books but not in the list:</p>
          <ul className="flex flex-col gap-2">
            {strays.map((t) => (
              <StrayTag key={t} tag={t} count={books.filter((b) => b.tags.includes(t)).length} list={list} onAdd={() => add([t])} onRenamed={() => router.refresh()} />
            ))}
          </ul>
        </div>
      )}

      <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10 -mx-1 flex items-center justify-end gap-3 border-t bg-background/90 px-1 py-3 backdrop-blur md:bottom-0">
        {dirty && <span className="text-sm text-muted-foreground">Unsaved changes</span>}
        <Button
          className="h-10 rounded-full px-6"
          disabled={!dirty || pending}
          onClick={() =>
            start(async () => {
              const r = await saveTagList(list);
              if (!r.ok) return void toast.error(r.error);
              setList(r.data);
              onSaved(r.data);
              toast.success("Tag list saved");
            })
          }
        >
          Save the list
        </Button>
      </div>
    </section>
  );
}

/** A tag on your books that isn't in the list: add it, or merge it into a tag that is (e.g. Відьми → відьми). */
function StrayTag({ tag, count, list, onAdd, onRenamed }: { tag: string; count: number; list: string[]; onAdd: () => void; onRenamed: () => void }) {
  const [into, setInto] = useState(() => list.find((t) => t === normalizeTag(tag)) ?? "");
  const [pending, start] = useTransition();
  return (
    <li className="flex flex-wrap items-center gap-2 text-sm">
      <span className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 ring-1 ring-border">
        {tag}
        <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
      </span>
      <Button type="button" size="sm" variant="ghost" className="rounded-full" onClick={onAdd}>
        <Plus aria-hidden />
        Add to list
      </Button>
      {list.length > 0 && (
        <>
          <span className="text-muted-foreground">or rename on your books to</span>
          <select value={into} onChange={(e) => setInto(e.target.value)} className="h-8 rounded-lg border border-input bg-background px-2 text-sm" aria-label={`Rename “${tag}” to`}>
            <option value="">choose a tag…</option>
            {list.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-full"
            disabled={!into || pending}
            onClick={() =>
              start(async () => {
                const r = await renameTag(tag, into);
                if (!r.ok) return void toast.error(r.error);
                toast.success(`Renamed on ${plural(r.data, "book", "books")}`);
                onRenamed();
              })
            }
          >
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            Rename
          </Button>
        </>
      )}
    </li>
  );
}

// ───────────────────────── Tag your books ─────────────────────────

function TagYourBooks({ tagList, books }: { tagList: string[]; books: TagBook[] }) {
  const router = useRouter();
  const untagged = useMemo(() => books.filter((b) => b.tags.length === 0), [books]);
  const [scope, setScope] = useState<"untagged" | "all">("untagged");
  const [results, setResults] = useState<Map<string, TagSuggestion>>(new Map());
  const [chosen, setChosen] = useState<Map<string, Set<string>>>(new Map());
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [saving, startSaving] = useTransition();
  const [running, setRunning] = useState(false);
  const stop = useRef(false);

  const target = scope === "untagged" ? untagged : books;
  const byId = useMemo(() => new Map(books.map((b) => [b.id, b])), [books]);

  const run = async () => {
    stop.current = false;
    setRunning(true);
    setResults(new Map());
    setChosen(new Map());
    const ids = target.map((b) => b.id);
    setProgress({ done: 0, total: ids.length });
    for (let i = 0; i < ids.length && !stop.current; i += TAG_BATCH) {
      const batch = ids.slice(i, i + TAG_BATCH);
      const r = await suggestTagsForBooks(batch);
      if (!r.ok) {
        toast.error(r.error);
        break;
      }
      setResults((m) => new Map([...m, ...r.data.map((s) => [s.bookId, s] as const)]));
      setChosen((m) => new Map([...m, ...r.data.map((s) => [s.bookId, new Set(s.tags)] as const)]));
      setProgress({ done: Math.min(i + TAG_BATCH, ids.length), total: ids.length });
    }
    setProgress((p) => (p ? { ...p, total: p.done } : p));
    setRunning(false);
  };

  const withSuggestions = [...results.values()].filter((s) => s.tags.length > 0);
  const toSave = [...chosen.entries()].filter(([, tags]) => tags.size > 0);
  const toggle = (bookId: string, tag: string) =>
    setChosen((m) => {
      const next = new Map(m);
      const set = new Set(next.get(bookId));
      if (set.has(tag)) set.delete(tag);
      else set.add(tag);
      next.set(bookId, set);
      return next;
    });

  return (
    <section aria-labelledby="tag-books-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="tag-books-title" className="font-heading text-2xl font-semibold text-heading">
          Tag your books
        </h2>
        <p className="text-muted-foreground">
          Claude suggests up to 4 tags per book from your saved list, judging by the description, genres and title. Nothing changes until you save.
        </p>
      </div>

      {tagList.length === 0 ? (
        <p className="text-sm text-muted-foreground">Save a tag list first.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div role="radiogroup" aria-label="Which books" className="flex rounded-full bg-muted p-1">
              {(
                [
                  ["untagged", `Without tags (${untagged.length})`],
                  ["all", `All books (${books.length})`],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={scope === value}
                  disabled={running}
                  onClick={() => setScope(value)}
                  className={cn("h-8 rounded-full px-3 text-sm", scope === value && "bg-background font-medium shadow-sm")}
                >
                  {label}
                </button>
              ))}
            </div>
            {running ? (
              <Button variant="outline" className="h-10 rounded-full px-5" onClick={() => (stop.current = true)}>
                <Square aria-hidden />
                Stop
              </Button>
            ) : (
              <Button className="h-10 rounded-full px-5" onClick={run} disabled={target.length === 0}>
                <Sparkles aria-hidden />
                Suggest tags for {plural(target.length, "book", "books")}
              </Button>
            )}
            {progress && (
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {running ? `Looking at ${progress.done} of ${progress.total}…` : `Looked at ${plural(progress.done, "book", "books")}`}
                {results.size > 0 && ` · suggestions for ${withSuggestions.length} · no good fit for ${results.size - withSuggestions.length}`}
              </p>
            )}
          </div>

          {withSuggestions.length > 0 && (
            <>
              <ul className="flex flex-col divide-y" aria-label="Suggested tags">
                {withSuggestions.map((s) => {
                  const b = byId.get(s.bookId);
                  if (!b) return null;
                  const picked = chosen.get(s.bookId) ?? new Set<string>();
                  return (
                    <li key={s.bookId} className="flex items-start gap-3 py-3">
                      <div className="w-10 shrink-0">
                        <BookCover title={b.title} authors={b.authors} src={b.coverSrc} lang={b.language} sizes="40px" compact />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <span lang={b.language} className="font-medium">
                          {b.title}
                          {b.authors.length > 0 && <span className="font-normal text-muted-foreground"> · {b.authors.join(", ")}</span>}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {b.tags.map((t) => (
                            <span key={t} className="inline-flex h-7 items-center rounded-full bg-muted px-2.5 text-xs text-muted-foreground">
                              {t}
                            </span>
                          ))}
                          {s.tags.map((t) => (
                            <button
                              key={t}
                              type="button"
                              aria-pressed={picked.has(t)}
                              onClick={() => toggle(s.bookId, t)}
                              className={cn(
                                "inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-medium ring-1",
                                picked.has(t) ? "bg-primary text-primary-foreground ring-primary" : "text-muted-foreground ring-border line-through",
                              )}
                            >
                              {picked.has(t) ? <Check className="size-3" aria-hidden /> : <X className="size-3" aria-hidden />}
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10 -mx-1 flex items-center justify-end gap-3 border-t bg-background/90 px-1 py-3 backdrop-blur md:bottom-0">
                <span className="text-sm text-muted-foreground">Tap a tag to leave it out.</span>
                <Button
                  className="h-10 rounded-full px-6"
                  disabled={saving || running || toSave.length === 0}
                  onClick={() =>
                    startSaving(async () => {
                      const r = await applyTagSuggestions(toSave.map(([bookId, tags]) => ({ bookId, tags: [...tags] })));
                      if (!r.ok) return void toast.error(r.error);
                      toast.success(`Tagged ${plural(r.data, "book", "books")}`);
                      setResults(new Map());
                      setChosen(new Map());
                      setProgress(null);
                      router.refresh();
                    })
                  }
                >
                  {saving ? <Loader2 className="animate-spin" aria-hidden /> : <Tags aria-hidden />}
                  Save tags for {plural(toSave.length, "book", "books")}
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
