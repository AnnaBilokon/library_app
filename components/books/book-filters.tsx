"use client";

import { useId, useMemo, useState } from "react";
import { Check, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { normalize, type BookFilters, type FacetOption, type Facets } from "@/lib/books/filters";
import { FORMAT_LABEL, languageLabel } from "@/lib/books/labels";
import type { BookFormat } from "@/lib/types";
import { cn } from "@/lib/utils";

interface BookFiltersPanelProps {
  filters: BookFilters;
  facets: Facets;
  onChange: (patch: Partial<BookFilters>) => void;
}

/** Everything except search and status, which live in the toolbar. Sections without data are hidden. */
export function BookFiltersPanel({ filters, facets, onChange }: BookFiltersPanelProps) {
  return (
    <div className="flex flex-col gap-6">
      <Section title="Shelf">
        <ToggleGroup
          variant="outline"
          value={[filters.owned === null ? "all" : filters.owned ? "owned" : "not-owned"]}
          onValueChange={(v) => {
            const next = v[0];
            if (next) onChange({ owned: next === "all" ? null : next === "owned" });
          }}
          className="w-full"
        >
          <ToggleGroupItem value="all" className="flex-1">All</ToggleGroupItem>
          <ToggleGroupItem value="owned" className="flex-1">Owned</ToggleGroupItem>
          <ToggleGroupItem value="not-owned" className="flex-1">Not owned</ToggleGroupItem>
        </ToggleGroup>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={filters.favorite === true} onCheckedChange={(c) => onChange({ favorite: c ? true : null })} />
          <Heart className="size-4 text-primary" aria-hidden />
          Favourites only
        </label>
      </Section>

      {facets.genre.length > 0 && (
        <Section title="Genre">
          <CheckList options={facets.genre} selected={filters.genre} onChange={(genre) => onChange({ genre })} />
        </Section>
      )}

      <Section title="Author">
        <SearchablePick
          options={facets.author}
          value={filters.author}
          onChange={(author) => onChange({ author })}
          placeholder="Find an author…"
        />
      </Section>

      {facets.finishedYears.length > 0 && (
        <Section title="Year finished">
          <Select
            value={filters.finishedYear === null ? "any" : String(filters.finishedYear)}
            onValueChange={(v) => onChange({ finishedYear: v === "any" || v === null ? null : Number(v) })}
            items={[{ value: "any", label: "Any year" }, ...facets.finishedYears.map((y) => ({ value: String(y), label: String(y) }))]}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any year</SelectItem>
              {facets.finishedYears.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Section>
      )}

      {facets.language.length > 1 && (
        <Section title="Language">
          <CheckList
            options={facets.language}
            selected={filters.language}
            onChange={(language) => onChange({ language })}
            label={languageLabel}
          />
        </Section>
      )}

      {facets.format.length > 1 && (
        <Section title="Format">
          <CheckList
            options={facets.format}
            selected={filters.format}
            onChange={(format) => onChange({ format: format as BookFormat[] })}
            label={(v) => FORMAT_LABEL[v as BookFormat] ?? v}
          />
        </Section>
      )}

      {facets.publisher.length > 0 && (
        <Section title="Publisher">
          <CheckList options={facets.publisher} selected={filters.publisher} onChange={(publisher) => onChange({ publisher })} />
        </Section>
      )}

      {facets.series.length > 0 && (
        <Section title="Series">
          <SearchablePick options={facets.series} value={filters.series} onChange={(series) => onChange({ series })} placeholder="Find a series…" />
        </Section>
      )}

      {facets.tag.length > 0 && (
        <Section title="Tags">
          <CheckList options={facets.tag} selected={filters.tag} onChange={(tag) => onChange({ tag })} />
        </Section>
      )}

      {facets.hasRatings && (
        <Section title="Rating">
          <RangeFilter
            min={0}
            max={5}
            step={0.5}
            value={[filters.ratingMin, filters.ratingMax]}
            onChange={([ratingMin, ratingMax]) => onChange({ ratingMin, ratingMax })}
            format={(v) => `${v}★`}
          />
        </Section>
      )}

      {facets.hasPages && (
        <Section title="Pages">
          <RangeFilter
            min={0}
            max={Math.ceil(facets.maxPages / 100) * 100}
            step={50}
            value={[filters.pagesMin, filters.pagesMax]}
            onChange={([pagesMin, pagesMax]) => onChange({ pagesMin, pagesMax })}
            format={String}
          />
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2.5">
      <h3 id={id} className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

const COLLAPSED = 8;

/** Multi-select list of facet values with counts; long lists collapse behind "Show all". */
function CheckList({
  options,
  selected,
  onChange,
  label = (v) => v,
}: {
  options: FacetOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  label?: (value: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  // Selected values always stay visible, even when the list is collapsed.
  const visible = expanded ? options : options.filter((o, i) => i < COLLAPSED || selected.includes(o.value));

  return (
    <div className="flex flex-col gap-1">
      {visible.map((o) => {
        const checked = selected.includes(o.value);
        return (
          <label key={o.value} className="flex items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-muted">
            <Checkbox
              checked={checked}
              onCheckedChange={(c) => onChange(c ? [...selected, o.value] : selected.filter((s) => s !== o.value))}
            />
            <span className="flex-1 truncate">{label(o.value)}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{o.count}</span>
          </label>
        );
      })}
      {options.length > COLLAPSED && (
        <Button variant="link" size="sm" className="self-start px-1" onClick={() => setExpanded((e) => !e)}>
          {expanded ? "Show fewer" : `Show all ${options.length}`}
        </Button>
      )}
    </div>
  );
}

/** Single-select from a long list (e.g. 300 authors) with a search box. */
function SearchablePick({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: FacetOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const q = normalize(query.trim());
    return (q ? options.filter((o) => normalize(o.value).includes(q)) : options).slice(0, 50);
  }, [options, query]);

  return (
    <div className="flex flex-col gap-2">
      {value && (
        <div className="flex items-center justify-between gap-2 rounded-md bg-highlight px-2 py-1.5 text-sm text-highlight-foreground">
          <span className="truncate font-medium">{value}</span>
          <Button variant="ghost" size="xs" onClick={() => onChange(null)} className="hover:bg-black/10">
            Clear
          </Button>
        </div>
      )}
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      <ul className="flex max-h-48 flex-col overflow-y-auto rounded-md border" role="listbox" aria-label={placeholder}>
        {matches.map((o) => (
          <li key={o.value}>
            <button
              type="button"
              role="option"
              aria-selected={o.value === value}
              onClick={() => onChange(o.value === value ? null : o.value)}
              className={cn(
                "flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                o.value === value && "font-medium",
              )}
            >
              <Check className={cn("size-3.5 shrink-0", o.value !== value && "invisible")} aria-hidden />
              <span className="flex-1 truncate">{o.value}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{o.count}</span>
            </button>
          </li>
        ))}
        {matches.length === 0 && <li className="px-2 py-3 text-sm text-muted-foreground">No matches</li>}
      </ul>
    </div>
  );
}

/** Two-thumb slider; the ends of the range mean "no limit". */
function RangeFilter({
  min,
  max,
  step,
  value,
  onChange,
  format,
}: {
  min: number;
  max: number;
  step: number;
  value: [number | null, number | null];
  onChange: (value: [number | null, number | null]) => void;
  format: (v: number) => string;
}) {
  const [low, high] = [value[0] ?? min, value[1] ?? max];
  // Track the thumbs locally while dragging, and only update the URL when the drag ends.
  const [draft, setDraft] = useState<[number, number] | null>(null);
  const shown = draft ?? [low, high];
  const labelId = useId();

  return (
    <div className="flex flex-col gap-3">
      <Label id={labelId} className="justify-between text-xs text-muted-foreground tabular-nums">
        <span>{shown[0] === min ? "Any" : format(shown[0])}</span>
        <span>{shown[1] === max ? "Any" : format(shown[1])}</span>
      </Label>
      <Slider
        aria-labelledby={labelId}
        min={min}
        max={max}
        step={step}
        value={shown}
        onValueChange={(v) => setDraft(v as [number, number])}
        onValueCommitted={(v) => {
          const [a, b] = v as [number, number];
          setDraft(null);
          onChange([a === min ? null : a, b === max ? null : b]);
        }}
      />
    </div>
  );
}
