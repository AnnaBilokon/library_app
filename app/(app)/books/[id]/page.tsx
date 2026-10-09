import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Copy } from "lucide-react";
import { BookCover } from "@/components/books/book-cover";
import { BookDeleteButton, BookEditButton, BookQuickControls } from "@/components/books/book-controls";
import { ReadingHistory } from "@/components/books/reading-history";
import { Skeleton } from "@/components/ui/skeleton";
import { duplicateKey } from "@/lib/books/duplicates";
import { FORMAT_LABEL, formatDate, formatMoney, languageLabel } from "@/lib/books/labels";
import { libraryUrl } from "@/lib/books/library-url";
import { buildSuggestions } from "@/lib/books/suggestions";
import { getBook, getBooks } from "@/lib/data/books";
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
  const [book, all] = await Promise.all([getBook(id), getBooks()]);
  if (!book) notFound();

  const key = duplicateKey(book);
  const duplicates = all.filter((b) => b.id !== book.id && duplicateKey(b) === key);

  return (
    <article className="grid gap-8 md:grid-cols-[18rem_1fr] md:gap-14">
      <div className="mx-auto w-48 sm:w-56 md:sticky md:top-24 md:mx-0 md:w-full md:self-start">
        <BookCover title={book.title} authors={book.authors} src={book.coverSrc} lang={book.language} sizes="(min-width: 768px) 288px, 224px" priority />
      </div>

      <div className="flex min-w-0 flex-col gap-10">
        <header className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <h1 lang={book.language} className="font-heading text-4xl leading-[1.1] font-semibold tracking-tight text-balance text-heading md:text-5xl">
              {book.title}
            </h1>
            {book.authors.length > 0 && (
              <p lang={book.language} className="text-xl text-muted-foreground">
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
          <BookQuickControls key={`${book.status}-${book.rating}-${book.favorite}`} book={book} />

          <div className="flex flex-wrap gap-2">
            <BookEditButton book={book} suggestions={buildSuggestions(all)} />
            <BookDeleteButton book={book} />
          </div>
        </header>

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

        <ReadingHistory bookId={book.id} readings={book.readings} />
        <Details book={book} />

        {book.notes && (
          <section className="flex flex-col gap-4">
            <h2 className="font-heading text-2xl font-semibold text-heading">Notes</h2>
            <blockquote className="border-l-4 border-highlight pl-5 font-heading text-lg leading-relaxed whitespace-pre-wrap italic">
              {book.notes}
            </blockquote>
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
  add(
    "Publisher",
    book.publisher && (
      <Link href={libraryUrl({ publisher: [book.publisher] })} className="hover:underline">
        {book.publisher}
      </Link>
    ),
  );
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
