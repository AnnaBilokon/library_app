"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Square } from "lucide-react";
import { makeReleasePicks } from "@/app/actions/release-picks";
import { collectReleaseLinks, importReleaseLink, refreshReleaseDetails, sortReleasesIntoGenres } from "@/app/actions/releases";
import { Button } from "@/components/ui/button";
import { GENRE_BATCH } from "@/lib/catalog/genres";
import type { ReleaseSource } from "@/lib/data/releases";
import { todayLocal } from "@/lib/dates";

interface SourceResult {
  label: string;
  note: string;
  failed?: boolean;
}

/**
 * "Check for new releases": for each source, collect the book links the catalog doesn't have,
 * read each one into a draft, then sort the new ones into your genres. Step by step from the
 * browser, so progress shows and Stop works; known links are skipped, so later checks are quick.
 */
export function ReleaseCheck({ sources }: { sources: ReleaseSource[] }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [results, setResults] = useState<SourceResult[]>([]);
  const stop = useRef(false);

  const run = async () => {
    stop.current = false;
    setRunning(true);
    setResults([]);
    const added: string[] = [];
    // Books that got a description just now: sorted into genres along with the new ones.
    const described: string[] = [];
    let failedBooks = 0;

    for (const source of sources) {
      if (stop.current) break;
      setStatus(`${source.label}: reading the listing…`);
      const collected = await collectReleaseLinks(source.id);
      if (!collected.ok) {
        setResults((rs) => [...rs, { label: source.label, note: collected.error, failed: true }]);
        continue;
      }
      const { links, refresh, found, claimed } = collected.data;
      let addedHere = 0;
      for (let i = 0; i < links.length && !stop.current; i++) {
        setStatus(`${source.label}: reading book ${i + 1} of ${links.length}…`);
        const r = await importReleaseLink(source.id, links[i]).catch(() => null);
        if (r?.ok && r.data.status === "added") {
          added.push(r.data.editionId);
          addedHere++;
        } else if (!r?.ok || r.data.status === "failed") failedBooks++;
      }
      let filled = 0;
      for (let i = 0; i < refresh.length && !stop.current; i++) {
        setStatus(`${source.label}: filling in details ${i + 1} of ${refresh.length}…`);
        const r = await refreshReleaseDetails(refresh[i]).catch(() => null);
        if (r?.ok && r.data) {
          described.push(r.data);
          filled++;
        }
      }
      setResults((rs) => [
        ...rs,
        {
          label: source.label,
          note: [
            `${found} on the page`,
            links.length === 0 ? "nothing new" : `${addedHere} new added`,
            claimed > 0 && `${claimed} already in the catalog now shown here`,
            filled > 0 && `${filled} descriptions filled in`,
          ]
            .filter(Boolean)
            .join(" · "),
        },
      ]);
    }

    const toSort = [...new Set([...added, ...described])];
    for (let i = 0; i < toSort.length && !stop.current; i += GENRE_BATCH) {
      setStatus(`Sorting books into your genres (${Math.min(i + GENRE_BATCH, toSort.length)} of ${toSort.length})…`);
      await sortReleasesIntoGenres(toSort.slice(i, i + GENRE_BATCH)).catch(() => null);
    }

    let picked = 0;
    if (!stop.current) {
      setStatus("Picking books you may like…");
      const r = await makeReleasePicks(todayLocal()).catch(() => null);
      if (r?.ok) picked = r.data;
    }

    setStatus(
      `${stop.current ? "Stopped" : "Done"}: ${added.length === 0 ? "no new books" : `${added.length} new ${added.length === 1 ? "book" : "books"} added`}${
        failedBooks ? ` · ${failedBooks} couldn't be read` : ""
      }${picked ? ` · ${picked} new ${picked === 1 ? "pick" : "picks"} for you` : ""}.`,
    );
    setRunning(false);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-accent/70 p-4 dark:bg-accent/60">
      <div className="flex flex-wrap items-center gap-3">
        {running ? (
          <Button variant="outline" className="h-10 rounded-full px-5" onClick={() => (stop.current = true)}>
            <Square aria-hidden />
            Stop
          </Button>
        ) : (
          <Button className="h-10 rounded-full px-5" onClick={run} disabled={sources.length === 0}>
            <RefreshCw aria-hidden />
            Check for new releases
          </Button>
        )}
        <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
          {running && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {status ?? `Reads ${sources.length} publisher ${sources.length === 1 ? "page" : "pages"}; books already in the catalog are skipped.`}
        </p>
      </div>
      {results.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-sm">
          {results.map((r) => (
            <li key={r.label} className={r.failed ? "text-destructive" : "text-muted-foreground"}>
              <span className="font-medium text-foreground">{r.label}</span> · {r.note}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
