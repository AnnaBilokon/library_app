"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CircleAlert, CircleCheck, CircleSlash, Loader2, RotateCcw, Square, Upload } from "lucide-react";
import { importCatalogLine, type ImportResult } from "@/app/actions/catalog-import";
import { BookCover } from "@/components/books/book-cover";
import { Button, buttonVariants } from "@/components/ui/button";
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
          {tooMany && ` · only the first ${IMPORT_LIMIT} will be imported`}
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
                setText(failed.map((r) => r.line.text).join("\n"));
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
