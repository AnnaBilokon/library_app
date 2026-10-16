import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ListPlus, Plus } from "lucide-react";
import { CatalogSearch } from "@/components/admin/catalog-search";
import { BookCover } from "@/components/books/book-cover";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth";
import { CATALOG_FILTERS, getCatalogCounts, PAGE_SIZE, RECENT_DAYS, searchCatalog, type CatalogFilter } from "@/lib/data/catalog";
import { formatDate } from "@/lib/books/labels";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Catalog" };

const FILTER_LABEL: Record<CatalogFilter, string> = {
  all: "All",
  recent: "Recently added",
  "to-review": "To review",
  drafts: "Drafts",
  "no-cover": "No cover",
  "no-isbn": "No ISBN",
  duplicates: "Possible duplicates",
};

interface Params {
  q: string;
  filter: CatalogFilter;
  page: number;
}

function catalogUrl({ q, filter, page }: Params): string {
  const sp = new URLSearchParams();
  if (q) sp.set("q", q);
  if (filter !== "all") sp.set("filter", filter);
  if (page > 1) sp.set("page", String(page));
  const s = sp.toString();
  return s ? `/admin?${s}` : "/admin";
}

export default function CatalogPage({ searchParams }: PageProps<"/admin">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pt-6 pb-12 md:px-8 md:pt-10">
      {/* Everything, the heading included, waits for the admin check: others get a 404. */}
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <Catalog searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Catalog({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const q = one(sp.q).trim().slice(0, 200);
  const filter = (CATALOG_FILTERS as readonly string[]).includes(one(sp.filter)) ? (one(sp.filter) as CatalogFilter) : "all";
  const page = Math.max(1, Math.floor(Number(one(sp.page)) || 1));

  const [{ editions, total }, counts] = await Promise.all([searchCatalog(q, filter, page), getCatalogCounts()]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Catalog"
        description="Every edition in the shared library. People's own books keep their copy of the details; fix the catalog here."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/import" className={cn(buttonVariants({ variant: "outline" }), "h-10 rounded-full px-5")}>
              <ListPlus aria-hidden />
              Import a list
            </Link>
            <Link href="/admin/editions/new" className={cn(buttonVariants(), "h-10 rounded-full px-5")}>
              <Plus aria-hidden />
              Add an edition
            </Link>
          </div>
        }
      />

      <div className="flex flex-col gap-4">
        <CatalogSearch q={q} filter={filter} />
        <nav aria-label="Filters" className="flex flex-wrap gap-1.5">
          {CATALOG_FILTERS.map((f) => (
            <Link
              key={f}
              href={catalogUrl({ q, filter: f, page: 1 })}
              aria-current={f === filter ? "page" : undefined}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium ring-1 ring-border hover:bg-muted",
                // Something waiting for review stands out even while another filter is on.
                f === "to-review" && counts[f] > 0 && f !== filter && "bg-accent ring-primary/40",
                f === filter && "bg-primary text-primary-foreground ring-primary hover:bg-primary/90",
              )}
            >
              {FILTER_LABEL[f]}
              <span className="tabular-nums opacity-70">{counts[f]}</span>
            </Link>
          ))}
        </nav>
      </div>

      <section aria-label="Editions" className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground" role="status">
          {total === 0 ? "No editions found." : `${total} ${total === 1 ? "edition" : "editions"}${q ? ` matching “${q}”` : ""}`}
          {filter === "recent" && ` · added in the last ${RECENT_DAYS} days, newest first`}
        </p>
        <ul className="flex flex-col divide-y">
          {editions.map((e) => (
            <li key={e.id}>
              <Link href={`/admin/editions/${e.id}`} className="flex items-center gap-4 py-3 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none">
                <div className="w-10 shrink-0">
                  <BookCover title={e.title} authors={e.authors} src={e.coverSrc} lang={e.language} sizes="40px" compact />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span lang={e.language} className="truncate font-medium">
                    {e.title}
                  </span>
                  <span className="truncate text-sm text-muted-foreground">{e.authors.join(", ") || "No author"}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {[e.publisher, e.publishedYear, e.isbn ?? "no ISBN"].filter(Boolean).join(" · ")}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                  {!e.reviewedAt && <span className="rounded-full bg-primary px-2 py-0.5 font-medium text-primary-foreground">To review</span>}
                  {e.status === "draft" && <span className="rounded-full bg-accent px-2 py-0.5 font-medium">Draft</span>}
                  {(!e.reviewedAt || filter === "recent") && <span className="text-muted-foreground">added {formatDate(e.createdAt.slice(0, 10))}</span>}
                  <span className="text-muted-foreground tabular-nums">{e.copies === 1 ? "1 copy" : `${e.copies} copies`}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
        {pages > 1 && (
          <nav aria-label="Pages" className="flex items-center justify-between gap-4 pt-2 text-sm">
            {page > 1 ? (
              <Link href={catalogUrl({ q, filter, page: page - 1 })} className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}>
                Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="text-muted-foreground tabular-nums">
              Page {page} of {pages}
            </span>
            {page < pages ? (
              <Link href={catalogUrl({ q, filter, page: page + 1 })} className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}>
                Next
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>
    </>
  );
}
