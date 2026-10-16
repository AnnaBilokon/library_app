import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Plus } from "lucide-react";
import { EditionForm } from "@/components/admin/edition-form";
import { EditionCover, EditionDangerZone } from "@/components/admin/edition-tools";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth";
import { formatDate, STATUS_LABEL } from "@/lib/books/labels";
import { buildSuggestions } from "@/lib/books/suggestions";
import { getBooks } from "@/lib/data/books";
import { getEdition, type MyCopy } from "@/lib/data/catalog";

export const metadata: Metadata = { title: "Edition" };

export default function EditionPage({ params }: PageProps<"/admin/editions/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pt-6 pb-12 md:px-8 md:pt-10">
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <EditionDetail params={params} />
      </Suspense>
    </main>
  );
}

async function EditionDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [detail, books] = await Promise.all([getEdition(id), getBooks()]);
  if (!detail) notFound();
  const { edition, copies, myCopy } = detail;
  const { authors, genres, publishers } = buildSuggestions(books);

  return (
    <>
      <Link href="/admin" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground focus-visible:underline focus-visible:outline-none">
        <ArrowLeft className="size-4" aria-hidden />
        Catalog
      </Link>
      <div className="grid gap-8 md:grid-cols-[14rem_1fr] md:gap-12">
        <aside className="mx-auto flex w-40 flex-col gap-6 md:sticky md:top-24 md:mx-0 md:w-full md:self-start">
          <EditionCover edition={edition} />
          <dl className="flex flex-col gap-3 text-sm">
            <div>
              <dt className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Linked books</dt>
              <dd>{copies === 1 ? "1 person's copy" : `${copies} people's copies`}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Your copy</dt>
              <dd>
                <YourCopy editionId={edition.id} copy={myCopy} />
              </dd>
            </div>
            {edition.sourceUrl && (
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Source</dt>
                <dd>
                  <a href={edition.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
                    {new URL(edition.sourceUrl).hostname.replace(/^www\./, "")}
                    <ExternalLink className="size-3" aria-hidden />
                  </a>
                </dd>
              </div>
            )}
            <div>
              <dt className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Updated</dt>
              <dd>{formatDate(edition.updatedAt.slice(0, 10))}</dd>
            </div>
          </dl>
        </aside>

        <div className="flex min-w-0 flex-col gap-10">
          <h1 lang={edition.language} className="font-heading text-3xl leading-tight font-semibold tracking-tight text-balance text-heading md:text-4xl">
            {edition.title}
          </h1>
          {/* key: start fresh when the saved edition changes */}
          <EditionForm key={edition.updatedAt} edition={edition} hasMyCopy={Boolean(myCopy)} suggestions={{ authors, genres, publishers }} />
          <section className="flex flex-col gap-3 border-t pt-6">
            <h2 className="font-heading text-xl font-semibold text-heading">Duplicates</h2>
            <EditionDangerZone edition={edition} copies={copies} />
          </section>
        </div>
      </div>
    </>
  );
}

const WHERE: Record<MyCopy["where"], string> = {
  shelves: "On your shelves",
  "not-owned": "Read, not owned (hidden from the Library's main view)",
  wishlist: "On your wishlist",
  sold: "Sold",
};

/**
 * Your own book for this edition. Shelf, status and rating are personal, so they're changed on the
 * book's page, not here.
 */
function YourCopy({ editionId, copy }: { editionId: string; copy?: MyCopy }) {
  if (!copy) {
    return (
      <div className="flex flex-col items-start gap-2">
        <span className="text-muted-foreground">Not in your library.</span>
        <Link
          href={`/books/new?edition=${editionId}`}
          className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-medium ring-1 ring-border hover:bg-muted"
        >
          <Plus className="size-3.5" aria-hidden />
          Add to my library
        </Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <span>{WHERE[copy.where]}</span>
      <span className="text-muted-foreground">
        {STATUS_LABEL[copy.status]}
        {copy.hasCover ? "" : " · no cover"}
      </span>
      <Link href={`/books/${copy.id}`} className="underline underline-offset-4 hover:text-primary">
        Open your book
      </Link>
      <span className="text-xs text-muted-foreground">Shelf, status and rating are changed there.</span>
    </div>
  );
}
