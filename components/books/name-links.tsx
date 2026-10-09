import Link from "next/link";
import { libraryUrl } from "@/lib/books/library-url";
import { cn } from "@/lib/utils";

/** Visibly a link, without shouting: a soft underline that darkens on hover. */
export const nameLinkClass = "underline decoration-border decoration-1 underline-offset-4 hover:text-foreground hover:decoration-current";
/** For lists of many books (cards, table rows): underlined only on hover or focus. */
const quietLinkClass = "underline-offset-4 hover:text-foreground hover:underline focus-visible:underline focus-visible:outline-none";

/** Each author opens the Library filtered to their books. */
export function AuthorLinks({ authors, className, lang, quiet }: { authors: string[]; className?: string; lang?: string; quiet?: boolean }) {
  return (
    <span lang={lang} className={className}>
      {authors.map((a, i) => (
        <span key={a}>
          {i > 0 && ", "}
          <Link href={libraryUrl({ author: a })} className={quiet ? quietLinkClass : nameLinkClass} title={`More books by ${a}`}>
            {a}
          </Link>
        </span>
      ))}
    </span>
  );
}

/** Opens the Library filtered to the publisher's books. */
export function PublisherLink({ publisher, className, quiet }: { publisher: string; className?: string; quiet?: boolean }) {
  return (
    <Link href={libraryUrl({ publisher: [publisher] })} className={cn(quiet ? quietLinkClass : nameLinkClass, className)} title={`More books from ${publisher}`}>
      {publisher}
    </Link>
  );
}
