import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookX, Copy } from "lucide-react";
import { BookCover } from "@/components/books/book-cover";
import { BookDeleteButton, BookEditButton, BookQueueButton, BookQuickControls, BookWishlistButton } from "@/components/books/book-controls";
import { BookCard } from "@/components/books/book-grid";
import { AuthorLinks, PublisherLink } from "@/components/books/name-links";
import { AuthorCountriesProvider } from "@/components/countries/author-countries-context";
import { CountryPicker } from "@/components/countries/country-picker";
import { ReadingHistory } from "@/components/books/reading-history";
import { DescriptionSection, ProgressPanel, RereadControls, ReviewSection } from "@/components/books/reading-tools";
import { SellBanner, SellButton } from "@/components/selling/selling-controls";
import { ForgottenButton } from "@/components/surprise/forgotten-button";
import { WishlistBanner } from "@/components/wishlist/wishlist-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { duplicateKey } from "@/lib/books/duplicates";
import { FORMAT_LABEL, formatDate, formatMoney, languageLabel } from "@/lib/books/labels";
import { libraryUrl } from "@/lib/books/library-url";
import { sortBooks } from "@/lib/books/filters";
import { lastStop, progressInfo } from "@/lib/books/progress";
import { buildSuggestions } from "@/lib/books/suggestions";
import { getAuthorCountries } from "@/lib/data/author-countries";
import { getBook, getBooks } from "@/lib/data/books";
import { inLibrary, salePriceLabel } from "@/lib/selling";
import type { Book } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/books/[id]">): Promise<Metadata> {
  const book = await getBook((await params).id);
  return { title: book?.title ?? "Book not found" };
}

export default function BookPage({ params }: PageProps<"/books/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pt-6 pb-12 md:px-8 md:pt-10">
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
  const [book, all, authorCountries] = await Promise.all([getBook(id), getBooks(), getAuthorCountries()]);
  if (!book) notFound();

  const key = duplicateKey(book);
  const duplicates = all.filter((b) => b.id !== book.id && duplicateKey(b) === key);

  return (
    <AuthorCountriesProvider value={authorCountries}>
    <article className="grid gap-8 md:grid-cols-[18rem_1fr] md:gap-14">
      <div className="mx-auto w-48 sm:w-56 md:sticky md:top-24 md:mx-0 md:w-full md:self-start">
        <BookCover title={book.title} authors={book.authors} src={book.coverSrc} lang={book.language} sizes="(min-width: 768px) 288px, 224px" priority />
      </div>

      <div className="flex min-w-0 flex-col gap-10">
        <header className="flex flex-col gap-5">
          {book.wanted && <WishlistBanner bookId={book.id} />}
          <SellBanner key={`${book.forSale}-${book.soldAt}`} book={book} />
          <div className="flex flex-col gap-3">
            <h1 lang={book.language} className="font-heading text-4xl leading-[1.1] font-semibold tracking-tight text-balance text-heading md:text-5xl">
              {book.title}
            </h1>
            {book.authors.length > 0 && (
              <p className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xl text-muted-foreground">
                {book.authors.map((a, i) => (
                  <span key={a} className="inline-flex items-center gap-1.5">
                    <AuthorLinks authors={[a]} lang={book.language} />
                    {/* key: start fresh when the saved countries change */}
                    <CountryPicker key={(authorCountries[a] ?? []).join()} author={a} countries={authorCountries[a] ?? []} />
                    {i < book.authors.length - 1 && <span aria-hidden>,</span>}
                  </span>
                ))}
              </p>
            )}
            {(book.genres.length > 0 || book.tags.length > 0) && (
              <ul className="flex flex-wrap gap-1.5" aria-label="Genres and tags">
                {book.genres.map((g) => (
                  <li key={g}>
                    <Link href={libraryUrl({ genre: [g] })} className="inline-flex h-7 items-center rounded-full bg-muted px-3 text-xs font-medium hover:bg-secondary">
                      {g}
                    </Link>
                  </li>
                ))}
                {book.tags.map((t) => (
                  <li key={t}>
                    <Link href={libraryUrl({ tag: [t] })} className="inline-flex h-7 items-center rounded-full bg-accent px-3 text-xs font-medium hover:bg-highlight">
                      #{t}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* key: start fresh when the server sends new values (e.g. after editing) */}
          <BookQuickControls key={`${book.status}-${book.wanted}-${book.rating}-${book.favorite}`} book={book} />
          <RereadControls book={book} />

          <div className="flex flex-wrap gap-2">
            {!book.wanted && !book.soldAt && <BookQueueButton book={book} />}
            <BookWishlistButton book={book} />
            <SellButton book={book} />
            <ForgottenButton key={String(book.forgotten)} book={book} />
            <BookEditButton book={book} suggestions={buildSuggestions(all)} />
            <BookDeleteButton book={book} />
          </div>
        </header>

        {book.status === "abandoned" && <DnfNote book={book} />}

        {duplicates.length > 0 && (
          <div role="note" className="flex gap-3 rounded-2xl bg-accent/80 p-4 text-sm">
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
              ). If it&apos;s a mistake, open it and remove it.
            </p>
          </div>
        )}

        {(book.status === "reading" || book.status === "paused") && (
          <ProgressPanel key={book.readings.map((r) => `${r.id}:${r.progressPage}:${r.progressPercent}`).join()} book={book} />
        )}
        {book.description && <DescriptionSection text={book.description} />}
        <ReviewSection key={book.review ?? ""} book={book} />
        <ReadingHistory bookId={book.id} readings={book.readings} totalPages={book.pages} />
        <Details book={book} />

        {book.notes && (
          <section className="flex flex-col gap-4">
            <h2 className="font-heading text-2xl font-semibold text-heading">Notes</h2>
            <blockquote className="border-l-4 border-highlight pl-5 font-heading text-lg leading-relaxed whitespace-pre-wrap italic">
              {book.notes}
            </blockquote>
          </section>
        )}

        <MoreBooks book={book} all={all} />
      </div>
    </article>
    </AuthorCountriesProvider>
  );
}

function Details({ book }: { book: Book }) {
  const rows: [string, React.ReactNode][] = [];
  const add = (label: string, value: React.ReactNode | undefined | false) => {
    if (value !== undefined && value !== false && value !== "") rows.push([label, value]);
  };
  add(
    "Publisher",
    book.publisher && <PublisherLink publisher={book.publisher} />,
  );
  add("Published", book.publishedYear);
  add("Pages", book.pages);
  add(
    "Series",
    book.series && (
      <Link href="/series" className="underline-offset-4 hover:underline">
        {book.series}
        {book.seriesIndex !== undefined ? ` #${book.seriesIndex}` : ""}
      </Link>
    ),
  );
  add("Language", book.language && languageLabel(book.language));
  add("Original language", book.originalLanguage && languageLabel(book.originalLanguage));
  add("Format", book.format && FORMAT_LABEL[book.format]);
  add("ISBN", book.isbn);
  add("On my shelf", book.owned ? "Yes" : book.soldAt ? "Sold" : "No");
  add("Added", book.acquiredAt && formatDate(book.acquiredAt));
  add("Bought for", book.purchasePrice !== undefined && formatMoney(book.purchasePrice, book.currency));
  const sold = salePriceLabel(book);
  add("Sold", book.soldAt && `${formatDate(book.soldAt)}${sold ? ` for ${sold.main}${sold.converted ? ` (≈ ${sold.converted})` : ""}` : ""}`);
  if (book.wanted) {
    add("Comes out", book.releaseDate && formatDate(book.releaseDate));
    add("Wishlist priority", book.priority);
    add("Expected price", book.wishPrice !== undefined && formatMoney(book.wishPrice, book.currency));
    add("Where to buy", book.whereToBuy);
    add("Why I want it", book.wishlistReason);
  }

  return (
    <section className="flex flex-col gap-5">
      <h2 className="font-heading text-2xl font-semibold text-heading">Details</h2>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex min-w-0 flex-col gap-1">
            <dt className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{label}</dt>
            <dd className="min-w-0 break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** A book you didn't finish: where you stopped, when, and why, right under the controls. */
function DnfNote({ book }: { book: Book }) {
  const stop = lastStop(book.readings);
  const where = progressInfo(stop, book.pages);
  return (
    <section aria-label="Did not finish" className="flex gap-3 rounded-2xl bg-muted/70 p-4">
      <BookX className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-medium">
          {where ? `Stopped at ${where.label}` : "Did not finish"}
          {stop?.finishedAt && <span className="font-normal text-muted-foreground"> · {formatDate(stop.finishedAt)}</span>}
        </p>
        {stop?.stopReason ? (
          <p className="font-heading text-lg leading-snug italic">“{stop.stopReason}”</p>
        ) : null}
        {(!where || !stop?.stopReason) && (
          <a href="#reading-history" className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
            {!where && !stop?.stopReason ? "Add where you stopped and why" : !where ? "Add where you stopped" : "Add why you stopped"} in Reading history
          </a>
        )}
      </div>
    </section>
  );
}

const SHELF_LIMIT = 12;

/** Other books in your library by the same author(s) and from the same publisher, newest added first. */
function MoreBooks({ book, all }: { book: Book; all: Book[] }) {
  const library = sortBooks(
    all.filter((b) => inLibrary(b) && b.id !== book.id),
    "added",
    "desc",
  );
  const shelves = [
    ...book.authors.slice(0, 3).map((a) => ({
      key: `author:${a}`,
      title: `More by ${a}`,
      href: libraryUrl({ author: a }),
      books: library.filter((b) => b.authors.includes(a)),
    })),
    ...(book.publisher
      ? [{ key: "publisher", title: `More from ${book.publisher}`, href: libraryUrl({ publisher: [book.publisher] }), books: library.filter((b) => b.publisher === book.publisher) }]
      : []),
  ].filter((s) => s.books.length > 0);
  if (shelves.length === 0) return null;

  return (
    <>
      {shelves.map((s) => (
        <section key={s.key} aria-label={s.title} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="font-heading text-2xl font-semibold text-heading">{s.title}</h2>
            <Link href={s.href} className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              {s.books.length > SHELF_LIMIT ? `See all ${s.books.length}` : s.books.length === 1 ? "1 book · open in Library" : `${s.books.length} books · open in Library`}
            </Link>
          </div>
          <ul className="-mx-4 flex snap-x scroll-px-4 gap-5 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
            {s.books.slice(0, SHELF_LIMIT).map((b) => (
              <li key={b.id} className="w-28 shrink-0 snap-start sm:w-32">
                <BookCard book={b} sizes="128px" />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

function BookSkeleton() {
  return (
    <div className="grid gap-8 md:grid-cols-[18rem_1fr] md:gap-14" aria-busy="true" aria-label="Loading book">
      <Skeleton className="mx-auto aspect-[2/3] w-48 sm:w-56 md:w-full" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-9 w-full max-w-md rounded-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}
