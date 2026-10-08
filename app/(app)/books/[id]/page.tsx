import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Copy, Heart, Star } from "lucide-react";
import { BookCover } from "@/components/books/book-cover";
import { StatusBadge } from "@/components/books/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { duplicateKey } from "@/lib/books/duplicates";
import { FORMAT_LABEL, formatDate, formatMoney, languageLabel } from "@/lib/books/labels";
import { libraryUrl } from "@/lib/books/library-url";
import { getBook, getBooks } from "@/lib/data/books";
import type { Book, Reading } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/books/[id]">): Promise<Metadata> {
  const book = await getBook((await params).id);
  return { title: book?.title ?? "Book not found" };
}

export default function BookPage({ params }: PageProps<"/books/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-6">
      <Link
        href="/library"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground focus-visible:underline focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Library
      </Link>
      {/* `params` is a Promise in this Next version; awaiting it inside Suspense keeps the shell instant. */}
      <Suspense fallback={<BookSkeleton />}>
        <BookDetail params={params} />
      </Suspense>
    </main>
  );
}

async function BookDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [book, all] = await Promise.all([getBook(id), getBooks()]);
  if (!book) notFound();

  const key = duplicateKey(book);
  const duplicates = all.filter((b) => b.id !== book.id && duplicateKey(b) === key);

  return (
    <article className="grid gap-6 md:grid-cols-[16rem_1fr] md:gap-10">
      <div className="mx-auto w-44 sm:w-52 md:mx-0 md:w-full">
        <BookCover title={book.title} authors={book.authors} src={book.coverSrc} lang={book.language} sizes="(min-width: 768px) 256px, 208px" priority />
      </div>

      <div className="flex min-w-0 flex-col gap-6">
        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={book.status} />
            {book.favorite && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                <Heart className="size-3.5 fill-current" aria-hidden /> Favourite
              </span>
            )}
            {book.wanted && <span className="rounded-full bg-highlight px-2 text-[11px] font-medium text-highlight-foreground">On wishlist</span>}
          </div>
          <h1 lang={book.language} className="font-heading text-3xl leading-tight font-semibold text-balance md:text-4xl">
            {book.title}
          </h1>
          {book.authors.length > 0 && (
            <p lang={book.language} className="text-lg text-muted-foreground">
              {book.authors.map((a, i) => (
                <span key={a}>
                  {i > 0 && ", "}
                  <Link href={libraryUrl({ author: a })} className="hover:text-foreground hover:underline">
                    {a}
                  </Link>
                </span>
              ))}
            </p>
          )}
          {book.rating !== undefined && <Rating value={book.rating} />}
          {(book.genres.length > 0 || book.tags.length > 0) && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Genres and tags">
              {book.genres.map((g) => (
                <li key={g}>
                  <Link href={libraryUrl({ genre: [g] })} className="inline-flex h-6 items-center rounded-full border px-2.5 text-xs hover:bg-muted">
                    {g}
                  </Link>
                </li>
              ))}
              {book.tags.map((t) => (
                <li key={t}>
                  <Link href={libraryUrl({ tag: [t] })} className="inline-flex h-6 items-center rounded-full bg-muted px-2.5 text-xs hover:bg-accent">
                    #{t}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </header>

        {duplicates.length > 0 && (
          <div role="note" className="flex gap-3 rounded-lg border border-dashed p-3 text-sm">
            <Copy className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <p>
              Possible duplicate: your library has {duplicates.length === 1 ? "another book" : `${duplicates.length} other books`} with the
              same title and author (
              {duplicates.map((d, i) => (
                <span key={d.id}>
                  {i > 0 && ", "}
                  <Link href={`/books/${d.id}`} className="underline">
                    {d.publisher ?? "copy"} {d.publishedYear ?? ""}
                  </Link>
                </span>
              ))}
              ).
            </p>
          </div>
        )}

        <Details book={book} />
        <ReadingHistory readings={book.readings} />

        {book.notes && (
          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold">Notes</h2>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{book.notes}</p>
          </section>
        )}
      </div>
    </article>
  );
}

function Details({ book }: { book: Book }) {
  const rows: [string, React.ReactNode][] = [];
  const add = (label: string, value: React.ReactNode | undefined | false) => {
    if (value !== undefined && value !== false && value !== "") rows.push([label, value]);
  };
  add("Publisher", book.publisher && <Link href={libraryUrl({ publisher: [book.publisher] })} className="hover:underline">{book.publisher}</Link>);
  add("Published", book.publishedYear);
  add("Pages", book.pages);
  add("Series", book.series && `${book.series}${book.seriesIndex !== undefined ? ` #${book.seriesIndex}` : ""}`);
  add("Language", book.language && languageLabel(book.language));
  add("Original language", book.originalLanguage && languageLabel(book.originalLanguage));
  add("Format", book.format && FORMAT_LABEL[book.format]);
  add("ISBN", book.isbn);
  add("On my shelf", book.owned ? "Yes" : book.soldAt ? "Sold" : "No");
  add("Added", book.acquiredAt && formatDate(book.acquiredAt));
  add("Bought for", book.purchasePrice !== undefined && formatMoney(book.purchasePrice, book.currency));
  add("Sold", book.soldAt && `${formatDate(book.soldAt)}${book.salePrice !== undefined ? ` for ${formatMoney(book.salePrice, book.currency)}` : ""}`);
  if (book.wanted) {
    add("Wishlist priority", book.priority);
    add("Expected price", book.wishPrice !== undefined && formatMoney(book.wishPrice, book.currency));
    add("Where to buy", book.whereToBuy);
    add("Why I want it", book.wishlistReason);
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-heading text-lg font-semibold">Details</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-lg border bg-card p-4 text-sm sm:grid-cols-[auto_1fr_auto_1fr]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="min-w-0 break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ReadingHistory({ readings }: { readings: Reading[] }) {
  if (readings.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-heading text-lg font-semibold">Reading history</h2>
      <ol className="flex flex-col gap-2">
        {readings.map((r, i) => (
          <li key={r.id} className="flex flex-wrap items-baseline gap-x-2 rounded-lg border bg-card px-4 py-3 text-sm">
            <span className="font-medium">{readings.length > 1 ? `Reading ${i + 1}` : "Read"}</span>
            <span className="text-muted-foreground">{describeReading(r)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function describeReading(r: Reading): string {
  const outcome = r.outcome === "finished" ? "Finished" : r.outcome === "abandoned" ? "Abandoned" : "In progress";
  if (!r.startedAt && !r.finishedAt) return `${outcome} · dates unknown`;
  const parts = [r.startedAt && `started ${formatDate(r.startedAt)}`, r.finishedAt && `${outcome.toLowerCase()} ${formatDate(r.finishedAt)}`];
  if (r.startedAt && r.finishedAt) {
    const days = Math.round((Date.parse(r.finishedAt) - Date.parse(r.startedAt)) / 86_400_000) + 1;
    parts.push(`${days} ${days === 1 ? "day" : "days"}`);
  }
  return parts.filter(Boolean).join(" · ");
}

function Rating({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5" role="img" aria-label={`Rated ${value} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <span key={i} className="relative size-5">
            <Star className="absolute size-5 text-muted-foreground/40" aria-hidden />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="size-5 fill-primary text-primary" aria-hidden />
            </span>
          </span>
        );
      })}
    </div>
  );
}

function BookSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-[16rem_1fr] md:gap-10" aria-busy="true" aria-label="Loading book">
      <Skeleton className="mx-auto aspect-[2/3] w-44 sm:w-52 md:w-full" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}
