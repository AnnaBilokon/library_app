"use client";

import { useMemo, useState } from "react";
import { geoEqualEarth, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import world from "world-atlas/countries-110m.json";
import { countryName } from "@/lib/countries";
import type { CountryCount } from "@/lib/countries";
import { MAP_ID_TO_CODE } from "@/lib/geo/map-ids";

const WIDTH = 960;
const HEIGHT = 470;

// Types come from the libraries' own signatures (their GeoJSON/TopoJSON type packages aren't direct deps).
type Topo = Parameters<typeof feature>[0] & { objects: { countries: Parameters<typeof feature>[1] } };
type Shape = Parameters<ReturnType<typeof geoPath>>[0] & { id?: string; properties: { name: string } };

/** Computed once: the country outlines as SVG paths, keyed by ISO alpha-2 (several shapes can share one). */
const SHAPES = (() => {
  const topo = world as unknown as Topo;
  const all = (feature(topo, topo.objects.countries) as unknown as { features: Shape[] }).features;
  const projection = geoEqualEarth().fitExtent(
    [
      [4, 4],
      [WIDTH - 4, HEIGHT - 4],
    ],
    { type: "FeatureCollection", features: all.filter((f) => MAP_ID_TO_CODE[f.id ?? f.properties.name] !== "AQ") } as Parameters<ReturnType<typeof geoEqualEarth>["fitExtent"]>[1],
  );
  const path = geoPath(projection);
  return all
    .map((f) => ({ code: MAP_ID_TO_CODE[f.id ?? f.properties.name], d: path(f) ?? "" }))
    .filter((s) => s.code && s.code !== "AQ" && s.d);
})();

/**
 * Countries you read, shaded light to dark by number of books (one hue, so darker simply means
 * more); the rest stay neutral. Hovering or focusing a country shows its count; the ranked list
 * beside the map carries the same numbers for anyone not using the map.
 */
export function WorldMap({ countries, onSelect, selected }: { countries: CountryCount[]; onSelect?: (code: string) => void; selected?: string | null }) {
  const [hover, setHover] = useState<string | null>(null);
  const counts = useMemo(() => new Map(countries.map((c) => [c.code, c.books.length])), [countries]);
  const max = Math.max(1, ...counts.values());
  // Five steps of the chart colour mixed into the card surface: legible in light and dark mode.
  const shade = (n: number) => `color-mix(in oklab, var(--chart-actual) ${Math.round(28 + (n / max) * 72)}%, var(--card))`;
  const active = hover ?? selected ?? null;
  const activeCount = active ? (counts.get(active) ?? 0) : 0;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label="World map of the countries your authors are from">
        {SHAPES.map((s, i) => {
          const n = counts.get(s.code) ?? 0;
          return (
            <path
              key={`${s.code}-${i}`}
              d={s.d}
              fill={n ? shade(n) : "var(--muted)"}
              stroke={s.code === active ? "var(--foreground)" : "var(--card)"}
              strokeWidth={s.code === active ? 1.5 : 0.6}
              className={n ? "cursor-pointer transition-[fill]" : undefined}
              onMouseEnter={() => setHover(s.code)}
              onMouseLeave={() => setHover(null)}
              onClick={() => n && onSelect?.(s.code)}
            />
          );
        })}
      </svg>
      {active && (
        <p className="pointer-events-none absolute top-2 left-2 rounded-lg bg-popover/95 px-3 py-1.5 text-sm shadow-md ring-1 ring-border/60" aria-live="polite">
          <span className="font-semibold">{countryName(active)}</span>{" "}
          <span className="text-muted-foreground">{activeCount ? `· ${activeCount} ${activeCount === 1 ? "book" : "books"}` : "· not read yet"}</span>
        </p>
      )}
    </div>
  );
}
