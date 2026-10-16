"use client";

import { useId, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { CircleAlert, CircleCheck, CircleSlash, Link2, Loader2, RotateCcw, Square, Upload } from "lucide-react";
import { collectBookLinks, importCatalogLine, type ImportResult } from "@/app/actions/catalog-import";
import { BookCover } from "@/components/books/book-cover";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { IMPORT_LIMIT, parseImportList, type ImportLine } from "@/lib/catalog/import";
import { cn } from "@/lib/utils";

type Row = { line: ImportLine; result?: ImportResult; running?: boolean };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Paste links or ISBNs, one per line, and import them into the catalog one at a time (progress
 * shows as it goes, and Stop finishes the current line and stops). Each new edition is a draft in
 * To review.
 */
export function ImportList({ hasGoogleKey }: { hasGoogleKey: boolean }) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const stop = useRef(false);

  const lines = useMemo(() => parseImportList(text), [text]);
  const usable = lines.filter((l) => l.kind !== "invalid");
  const links = usable.filter((l) => l.kind === "link").length;
  const isbns = usable.length - links;
  const invalid = lines.length - usable.length;
  const tooMany = usable.length > IMPORT_LIMIT;

  const run = async () => {
    const queue = usable.slice(0, IMPORT_LIMIT);
    // Lines beyond the limit stay in the box for the next round.
    setText(usable.slice(IMPORT_LIMIT).map((l) => l.text).join("\n"));
    setRows(queue.map((line) => ({ line })));
    setRunning(true);
    stop.current = false;
    for (let i = 0; i < queue.length && !stop.current; i++) {
      setRows((rs) => rs.map((r, j) => (j === i ? { ...r, running: true } : r)));
      let result: ImportResult;
      try {
        const r = await importCatalogLine(queue[i].text);
        result = r.ok ? r.data : { status: "failed", reason: r.error };
      } catch {
        result = { status: "failed", reason: "Something went wrong with this one." };
      }
      setRows((rs) => rs.map((r, j) => (j === i ? { ...r, running: false, result } : r)));
    }
    setRunning(false);
  };

  const done = rows.filter((r) => r.result);
  const added = done.filter((r) => r.result?.status === "added").length;
  const existing = done.filter((r) => r.result?.status === "exists").length;
  const failed = rows.filter((r) => r.result?.status === "failed");

  return (
    <div className="flex flex-col gap-6">
      <CollectFromPage
        disabled={running}
        onCollected={(found) => setText((t) => [t.trim(), ...found].filter(Boolean).join("\n"))}
      />

      <div className="flex flex-col gap-2">
        <label htmlFor="import-list" className="text-sm font-medium">
          Links or ISBNs, one per line
        </label>
        <Textarea
          id="import-list"
          rows={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={running}
          placeholder={"https://vivat.com.ua/product/…\nhttps://starylev.com.ua/…\n978-617-8012-13-7"}
          className="font-mono text-sm"
        />
        <p className="text-sm text-muted-foreground" role="status">
          {lines.length === 0
            ? `Up to ${IMPORT_LIMIT} at a time. Repeats are skipped.`
            : [links && plural(links, "link", "links"), isbns && plural(isbns, "ISBN", "ISBNs"), invalid && `${plural(invalid, "line", "lines")} that can't be used`]
                .filter(Boolean)
                .join(" · ")}
          {tooMany && ` · the first ${IMPORT_LIMIT} are imported now, the rest stay here for the next round`}
        </p>
        {isbns > 0 && !hasGoogleKey && (
          <p className="text-xs text-muted-foreground">
            Without a Google Books key, ISBNs are looked up in Open Library only (good for English books, rarely has Ukrainian ones). Links work best.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {running ? (
          <Button variant="outline" className="h-10 rounded-full px-5" onClick={() => (stop.current = true)}>
            <Square aria-hidden />
            Stop
          </Button>
        ) : (
          <Button className="h-10 rounded-full px-5" onClick={run} disabled={usable.length === 0}>
            <Upload aria-hidden />
            Import {usable.length > 0 ? plural(Math.min(usable.length, IMPORT_LIMIT), "book", "books") : "books"}
          </Button>
        )}
        {rows.length > 0 && (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {running ? `Importing ${done.length + 1} of ${rows.length}…` : `Done: ${done.length} of ${rows.length}`}
            {done.length > 0 && ` · ${added} added · ${existing} already in the catalog · ${failed.length} couldn't be read`}
          </p>
        )}
      </div>

      {!running && done.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {added > 0 && (
            <Link href="/admin?filter=to-review" className={cn(buttonVariants(), "h-10 rounded-full px-5")}>
              <CircleCheck aria-hidden />
              Review the {plural(added, "new edition", "new editions")}
            </Link>
          )}
          {failed.length > 0 && (
            <Button
              variant="outline"
              className="h-10 rounded-full px-5"
              onClick={() => {
                // Ahead of any lines still waiting for the next round.
                setText((t) => [...failed.map((r) => r.line.text), t.trim()].filter(Boolean).join("\n"));
                setRows([]);
              }}
            >
              <RotateCcw aria-hidden />
              Put the {plural(failed.length, "failed line", "failed lines")} back in the box
            </Button>
          )}
        </div>
      )}

      {rows.length > 0 && (
        <ul className="flex flex-col divide-y" aria-label="Import progress">
          {rows.map((r, i) => (
            <ResultRow key={i} row={r} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ResultRow({ row: { line, result, running } }: { row: Row }) {
  const added = result?.status === "added" ? result : null;
  return (
    <li className="flex items-center gap-4 py-3">
      <div className="w-10 shrink-0">
        {added ? (
          <BookCover title={added.title} authors={added.authors} src={added.coverSrc} sizes="40px" compact />
        ) : (
          <div className="grid aspect-[2/3] place-items-center rounded-sm bg-muted text-muted-foreground">
            {running ? (
              <Loader2 className="size-4 animate-spin" aria-label="Importing" />
            ) : result?.status === "exists" ? (
              <CircleSlash className="size-4" aria-hidden />
            ) : result?.status === "failed" ? (
              <CircleAlert className="size-4 text-destructive" aria-hidden />
            ) : null}
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {result && result.status !== "failed" ? (
          <Link href={`/admin/editions/${result.editionId}`} className="line-clamp-2 font-medium underline-offset-4 hover:underline">
            {result.title}
          </Link>
        ) : (
          <span className="truncate font-mono text-sm">{line.text}</span>
        )}
        <span className={cn("text-sm", result?.status === "failed" ? "text-destructive" : "text-muted-foreground")}>
          {running
            ? "Reading…"
            : !result
              ? "Waiting"
              : result.status === "added"
                ? `Added as a draft · from ${result.site}${result.coverNote ? ` · ${result.coverNote}` : ""}`
                : result.status === "exists"
                  ? "Already in the catalog, skipped"
                  : result.reason}
        </span>
        {result && result.status !== "failed" && <span className="truncate font-mono text-xs text-muted-foreground">{line.text}</span>}
      </div>
    </li>
  );
}

/**
 * "Collect links from a page": reads a listing page (new releases, coming soon) and all its
 * further pages, and adds the book links it finds to the list below.
 */
function CollectFromPage({ disabled, onCollected }: { disabled: boolean; onCollected: (links: string[]) => void }) {
  const [url, setUrl] = useState("");
  const [pattern, setPattern] = useState("");
  const [pages, setPages] = useState(10);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const urlId = useId();
  const patternId = useId();
  const pagesId = useId();

  const collect = () =>
    start(async () => {
      setMessage(null);
      const r = await collectBookLinks(url, pattern, pages);
      if (!r.ok) return setMessage({ kind: "error", text: r.error });
      const { links, alreadyImported, note } = r.data;
      setPattern(r.data.pattern);
      onCollected(links);
      setMessage({
        kind: "ok",
        text: [
          `Found ${plural(links.length + alreadyImported, "book link", "book links")} on ${plural(r.data.pages, "page", "pages")} (links starting with ${r.data.pattern})`,
          alreadyImported > 0 && `${alreadyImported} already imported before ${alreadyImported === 1 ? "was" : "were"} left out`,
          links.length > 0 ? "added to the list below; check it, then import" : "nothing new to add",
          note,
        ]
          .filter(Boolean)
          .join(" · "),
      });
    });

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-accent/70 p-4 dark:bg-accent/60">
      <label htmlFor={urlId} className="flex items-center gap-2 text-sm font-medium">
        <Link2 className="size-4" aria-hidden />
        Collect links from a page
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id={urlId}
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && url.trim()) {
              e.preventDefault();
              collect();
            }
          }}
          placeholder="A publisher's new releases or coming soon page"
          className="h-10 bg-background"
          disabled={disabled || pending}
        />
        <Button type="button" variant="secondary" className="h-10 rounded-full px-4" onClick={collect} disabled={disabled || pending || !url.trim()}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {pending ? "Reading the pages…" : "Collect"}
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={pagesId} className="text-xs text-muted-foreground">
            Read up to
          </label>
          <select
            id={pagesId}
            value={pages}
            onChange={(e) => setPages(Number(e.target.value))}
            disabled={disabled || pending}
            className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
          >
            {[1, 2, 3, 5, 10, 20].map((n) => (
              <option key={n} value={n}>
                {plural(n, "page", "pages")}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-48 flex-1 flex-col gap-1">
          <label htmlFor={patternId} className="text-xs text-muted-foreground">
            Book links start with <span className="opacity-70">(found automatically; change it if the wrong links were picked)</span>
          </label>
          <Input
            id={patternId}
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="/product/"
            className="h-8 max-w-xs bg-background font-mono text-xs"
            disabled={disabled || pending}
          />
        </div>
      </div>
      {message && (
        <p className={cn("text-sm", message.kind === "error" ? "text-destructive" : "text-muted-foreground")} role="status">
          {message.text}
        </p>
      )}
    </div>
  );
}
