"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch, type FieldError, type Path, type PathValue } from "react-hook-form";
import { Heart, ImagePlus, Link2, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { createBook, updateBook, uploadCover } from "@/app/actions/books";
import { importCoverFromUrl, prefillFromUrl } from "@/app/actions/prefill";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { duplicateKey } from "@/lib/books/duplicates";
import { FORMAT_LABEL, languageLabel, STATUS_LABEL } from "@/lib/books/labels";
import { normalizeIsbn } from "@/lib/isbn";
import type { Prefill } from "@/lib/prefill/parse";
import { bookInputSchema, type BookFormValues, type BookInput } from "@/lib/schemas";
import { BOOK_FORMATS, type Book } from "@/lib/types";
import { STATUS_CHOICES, type StatusChoice } from "@/lib/wishlist";
import { cn } from "@/lib/utils";
import { BookCover } from "./book-cover";
import { RatingStars } from "./rating-stars";
import { TagInput } from "./tag-input";

const LANGUAGES = ["uk", "en", "sv", "pl", "de", "fr", "es", "it", "ja", "ru"];

export interface BookFormSuggestions {
  authors: string[];
  genres: string[];
  tags: string[];
  publishers: string[];
  /** Other books, to warn about duplicates. */
  existing: Pick<Book, "id" | "title" | "authors" | "isbn">[];
}

export function bookToFormValues(book: Book): BookFormValues {
  return {
    title: book.title,
    authors: book.authors,
    status: book.status,
    rating: book.rating ?? null,
    favorite: book.favorite,
    genres: book.genres,
    tags: book.tags,
    language: book.language ?? "",
    format: book.format ?? "",
    publisher: book.publisher ?? "",
    publishedYear: book.publishedYear,
    pages: book.pages,
    isbn: book.isbn ?? "",
    series: book.series ?? "",
    seriesIndex: book.seriesIndex,
    owned: book.owned,
    acquiredAt: book.acquiredAt ?? "",
    purchasePrice: book.purchasePrice,
    notes: book.notes ?? "",
    description: book.description ?? "",
    wanted: book.wanted,
    wishPrice: book.wishPrice,
    whereToBuy: book.whereToBuy ?? "",
    wishlistReason: book.wishlistReason ?? "",
  };
}

const EMPTY: BookFormValues = {
  title: "",
  authors: [],
  status: "to-read",
  rating: null,
  favorite: false,
  genres: [],
  tags: [],
  language: "uk",
  format: "paper",
  publisher: "",
  isbn: "",
  series: "",
  owned: true,
  acquiredAt: "",
  notes: "",
  description: "",
  wanted: false,
  whereToBuy: "",
  wishlistReason: "",
  startedAt: "",
  finishedAt: "",
  stopReason: "",
};

/** An empty form; from the Wishlist page it starts as a wishlist book (wanted, not owned). */
function newBookDefaults(forWishlist?: boolean): BookFormValues {
  return forWishlist ? { ...EMPTY, wanted: true, owned: false } : EMPTY;
}

interface BookFormProps {
  suggestions: BookFormSuggestions;
  /** Editing an existing book; without it the form creates a new one. */
  book?: Book;
  onDone?: () => void;
  onCancel?: () => void;
  /** In a full page the save bar must clear the phone's bottom tab bar; in a sheet it doesn't. */
  inSheet?: boolean;
  /** Opened from the Wishlist page: a book you want, not one you own. */
  forWishlist?: boolean;
}

export function BookForm({ suggestions, book, onDone, onCancel, inSheet, forWishlist }: BookFormProps) {
  const router = useRouter();
  const [saving, startSaving] = useTransition();
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const editing = Boolean(book);

  // react-hook-form keeps field state outside React state (like a ref), so typing doesn't
  // re-render the whole form; zodResolver runs the same schema the server uses.
  const form = useForm<BookFormValues, unknown, BookInput>({
    resolver: zodResolver(bookInputSchema),
    defaultValues: book ? bookToFormValues(book) : newBookDefaults(forWishlist),
    mode: "onTouched",
  });
  const { register, control, handleSubmit, formState } = form;
  const errors = formState.errors;

  // useWatch re-renders only when these fields change.
  const [status, title, authors, isbn, wanted] = useWatch({ control, name: ["status", "title", "authors", "isbn", "wanted"] });

  const duplicate = useMemo(() => {
    const others = suggestions.existing.filter((b) => b.id !== book?.id);
    const normalized = isbn ? normalizeIsbn(isbn) : null;
    if (normalized) {
      const sameIsbn = others.find((b) => b.isbn === normalized);
      // The database allows each ISBN only once per library, so this one blocks saving.
      if (sameIsbn) return { book: sameIsbn, sameIsbn: true };
    }
    if (title.trim() && authors.length) {
      const key = duplicateKey({ title, authors });
      const same = others.find((b) => duplicateKey(b) === key);
      if (same) return { book: same, sameIsbn: false };
    }
    return null;
  }, [suggestions.existing, book?.id, isbn, title, authors]);

  // A cover found by "Fill from a link"; copied into Storage when the book is saved.
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  // Bumped after adding a book, to start the link box and cover picker afresh.
  const [resetKey, setResetKey] = useState(0);

  /**
   * Puts details read from a web page into the form. For a new book everything found is used;
   * when editing, only empty fields are filled, so nothing you typed is overwritten.
   */
  const applyPrefill = (p: Prefill): { filled: string[]; kept: string[] } => {
    const filled: string[] = [];
    const kept: string[] = [];
    const isEmpty = (v: unknown) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0) || Number.isNaN(v);
    const fill = <K extends Path<BookFormValues>>(name: K, value: PathValue<BookFormValues, K> | undefined, label: string) => {
      if (isEmpty(value)) return;
      if (editing && !isEmpty(form.getValues(name))) {
        kept.push(label);
        return;
      }
      form.setValue(name, value as PathValue<BookFormValues, K>, { shouldDirty: true, shouldValidate: true });
      filled.push(label);
    };
    fill("title", p.title, "title");
    fill("authors", p.authors, "authors");
    fill("publisher", p.publisher, "publisher");
    fill("publishedYear", p.publishedYear, "year");
    fill("pages", p.pages, "pages");
    fill("isbn", p.isbn, "ISBN");
    fill("description", p.description, "description");
    if (p.language && !editing) form.setValue("language", p.language, { shouldDirty: true });
    if (p.coverUrl && !coverFile) {
      setCoverUrl(p.coverUrl);
      filled.push("cover");
    }
    return { filled, kept };
  };

  const onSubmit = (values: BookInput, event?: React.BaseSyntheticEvent) => {
    const formEl = event?.target instanceof HTMLFormElement ? event.target : null;
    startSaving(async () => {
      const result = book ? await updateBook(book.id, values) : await createBook(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const bookId = book?.id ?? (result.data as { id: string }).id;
      if (coverFile) {
        const fd = new FormData();
        fd.set("cover", coverFile);
        const upload = await uploadCover(bookId, fd);
        if (!upload.ok) toast.error(upload.error);
      } else if (coverUrl) {
        const imported = await importCoverFromUrl(bookId, coverUrl);
        if (!imported.ok) toast.warning(imported.error);
      }
      if (book) {
        toast.success("Saved");
        onDone?.();
        return;
      }
      // Stay on "Add a book" with an empty form, ready for the next one.
      toast.success(values.wanted ? `Added “${values.title}” to your wishlist` : `Added “${values.title}”`, {
        action: { label: "Open", onClick: () => router.push(`/books/${bookId}`) },
      });
      // Empty the inputs first: number fields (prices, pages, year) have no default, and
      // react-hook-form would otherwise keep what was typed there and send it again.
      formEl?.reset();
      form.reset(newBookDefaults(forWishlist));
      setCoverFile(null);
      setCoverUrl(null);
      setResetKey((k) => k + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      setTimeout(() => form.setFocus("title"), 50);
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-8">
      <PrefillFromLink key={`prefill-${resetKey}`} onPrefill={applyPrefill} editing={editing} />

      <div className="grid gap-8 md:grid-cols-[11rem_1fr]">
        <CoverPicker
          key={`cover-${resetKey}`}
          book={book}
          title={title}
          authors={authors}
          file={coverFile}
          linkedUrl={coverUrl}
          onFile={(f) => {
            setCoverFile(f);
            if (f) setCoverUrl(null);
          }}
          onClearLinked={() => setCoverUrl(null)}
        />

        <div className="flex min-w-0 flex-col gap-5">
          <Field label="Title" error={errors.title} required>
            {(id, describedBy) => (
              <Input
                id={id}
                {...register("title")}
                aria-invalid={Boolean(errors.title) || undefined}
                aria-describedby={describedBy}
                className="h-11 font-heading text-lg"
                autoFocus={!editing}
              />
            )}
          </Field>

          <Field label="Authors" hint="Press Enter after each name." error={errors.authors as FieldError | undefined}>
            {(id, describedBy) => (
              <Controller
                control={control}
                name="authors"
                render={({ field }) => (
                  <TagInput id={id} value={field.value} onChange={field.onChange} suggestions={suggestions.authors} aria-describedby={describedBy} />
                )}
              />
            )}
          </Field>

          {duplicate && (
            <p role="status" className="flex items-start gap-2 rounded-xl bg-accent p-3 text-sm">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                You already have a book with {duplicate.sameIsbn ? "this ISBN" : "the same title and author"}:{" "}
                <a href={`/books/${duplicate.book.id}`} target="_blank" rel="noreferrer" className="font-medium underline">
                  {duplicate.book.title}
                </a>
                .{" "}
                {duplicate.sameIsbn
                  ? "Each ISBN can only be saved once. For a second copy, clear the ISBN field."
                  : "You can still save it, e.g. for a second copy."}
              </span>
            </p>
          )}

          <Field label="Status">
            {() => (
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Segmented<StatusChoice>
                    label="Status"
                    // "Wishlist" is the wishlist flag underneath: the book is wanted, not owned, and to read.
                    value={wanted ? "wishlist" : field.value}
                    onChange={(v) => {
                      const toWishlist = v === "wishlist";
                      form.setValue("wanted", toWishlist, { shouldDirty: true });
                      if (toWishlist) form.setValue("owned", false, { shouldDirty: true });
                      field.onChange(toWishlist ? "to-read" : v);
                    }}
                    options={STATUS_CHOICES.map((s) => ({ value: s, label: s === "wishlist" ? "Wishlist" : STATUS_LABEL[s] }))}
                  />
                )}
              />
            )}
          </Field>

          {!editing && !wanted && status !== "to-read" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Started" error={errors.startedAt}>
                {(id, d) => <Input id={id} type="date" {...register("startedAt")} aria-describedby={d} className="h-10" />}
              </Field>
              {(status === "finished" || status === "abandoned") && (
                <Field label={status === "finished" ? "Finished" : "Stopped"} error={errors.finishedAt}>
                  {(id, d) => (
                    <Input id={id} type="date" {...register("finishedAt")} aria-invalid={Boolean(errors.finishedAt) || undefined} aria-describedby={d} className="h-10" />
                  )}
                </Field>
              )}
              {status === "abandoned" && (
                <>
                  <Field label="Stopped at page" error={errors.stoppedPage}>
                    {(id, d) => <Input id={id} type="number" min={0} inputMode="numeric" {...register("stoppedPage", { valueAsNumber: true })} aria-describedby={d} className="h-10" />}
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Why I stopped" error={errors.stopReason}>
                      {(id, d) => <Textarea id={id} {...register("stopReason")} rows={2} placeholder="Too slow, not in the mood, didn't like the translation…" aria-describedby={d} />}
                    </Field>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <Field label="Rating">
              {() => (
                <Controller
                  control={control}
                  name="rating"
                  render={({ field }) => <RatingStars value={field.value} onChange={field.onChange} size="lg" />}
                />
              )}
            </Field>
            <Controller
              control={control}
              name="favorite"
              render={({ field }) => (
                <button
                  type="button"
                  aria-pressed={field.value}
                  onClick={() => field.onChange(!field.value)}
                  className={cn(
                    "mt-6 inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium ring-1 ring-border transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    field.value && "text-red-700 ring-red-500 hover:bg-red-500/10 dark:text-red-400 dark:ring-red-400",
                  )}
                >
                  <Heart className={cn("size-4", field.value && "fill-current")} aria-hidden />
                  {field.value ? "Favourite" : "Mark as favourite"}
                </button>
              )}
            />
          </div>
        </div>
      </div>

      <Section title="About the book">
        <Field label="Description" hint="What the book is about. Filled in automatically from a link when the page has one.">
          {(id, d) => <Textarea id={id} {...register("description")} rows={5} aria-describedby={d} className="text-base" />}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Genres" hint="Press Enter after each.">
            {(id, d) => (
              <Controller
                control={control}
                name="genres"
                render={({ field }) => <TagInput id={id} value={field.value} onChange={field.onChange} suggestions={suggestions.genres} aria-describedby={d} />}
              />
            )}
          </Field>
          <Field label="Tags">
            {(id) => (
              <Controller
                control={control}
                name="tags"
                render={({ field }) => <TagInput id={id} value={field.value} onChange={field.onChange} suggestions={suggestions.tags} />}
              />
            )}
          </Field>
          <Field label="Publisher">
            {(id) => <DatalistInput id={id} {...register("publisher")} options={suggestions.publishers} />}
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Year published" error={errors.publishedYear}>
              {(id, d) => <Input id={id} type="number" inputMode="numeric" {...register("publishedYear", { valueAsNumber: true })} aria-describedby={d} className="h-10" />}
            </Field>
            <Field label="Pages" error={errors.pages}>
              {(id, d) => <Input id={id} type="number" inputMode="numeric" {...register("pages", { valueAsNumber: true })} aria-describedby={d} className="h-10" />}
            </Field>
          </div>
          <Field label="Language" error={errors.language}>
            {(id) => (
              <select id={id} {...register("language")} className={selectClass}>
                <option value="">—</option>
                {LANGUAGES.map((code) => (
                  <option key={code} value={code}>
                    {languageLabel(code)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Format">
            {(id) => (
              <select id={id} {...register("format")} className={selectClass}>
                <option value="">—</option>
                {BOOK_FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {FORMAT_LABEL[f]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="ISBN" error={errors.isbn}>
            {(id, d) => <Input id={id} inputMode="numeric" {...register("isbn")} aria-invalid={Boolean(errors.isbn) || undefined} aria-describedby={d} className="h-10" />}
          </Field>
          <div className="grid grid-cols-[1fr_6rem] gap-4">
            <Field label="Series">
              {(id) => <Input id={id} {...register("series")} className="h-10" />}
            </Field>
            <Field label="No." error={errors.seriesIndex}>
              {(id, d) => <Input id={id} type="number" step="0.5" {...register("seriesIndex", { valueAsNumber: true })} aria-describedby={d} className="h-10" />}
            </Field>
          </div>
        </div>
      </Section>

      <Section title="On my shelf">
        <div className="grid gap-5 sm:grid-cols-3">
          <Controller
            control={control}
            name="owned"
            render={({ field }) => (
              <label className="flex h-10 items-center gap-2 self-end text-sm font-medium">
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(c) => {
                    field.onChange(Boolean(c));
                    // Owned and wishlist exclude each other: a book you own isn't one you still want to buy.
                    if (c) form.setValue("wanted", false, { shouldDirty: true });
                  }}
                />
                I own this book
              </label>
            )}
          />
          <Field label="Added to my shelf" error={errors.acquiredAt}>
            {(id, d) => <Input id={id} type="date" {...register("acquiredAt")} aria-describedby={d} className="h-10" />}
          </Field>
          <Field label="Price paid (UAH)" error={errors.purchasePrice}>
            {(id, d) => <Input id={id} type="number" step="0.01" inputMode="decimal" {...register("purchasePrice", { valueAsNumber: true })} aria-describedby={d} className="h-10" />}
          </Field>
        </div>
      </Section>

      {wanted && (
        <Section title="Wishlist details">
          <p className="-mt-2 text-sm text-muted-foreground">This book will only show on your Wishlist until you mark it bought.</p>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Expected price (UAH)" error={errors.wishPrice}>
              {(id, d) => <Input id={id} type="number" step="0.01" inputMode="decimal" {...register("wishPrice", { valueAsNumber: true })} aria-describedby={d} className="h-10" />}
            </Field>
            <Field label="Where to buy">
              {(id) => <Input id={id} {...register("whereToBuy")} placeholder="Yakaboo, a bookshop…" className="h-10" />}
            </Field>
            <Field label="Why I want it">
              {(id) => <Input id={id} {...register("wishlistReason")} placeholder="Recommended by…" className="h-10" />}
            </Field>
          </div>
        </Section>
      )}

      <Section title="Notes">
        <Textarea {...register("notes")} rows={5} placeholder="Thoughts, quotes, who recommended it…" aria-label="Notes" className="text-base" />
      </Section>

      <div
        className={cn(
          "sticky -mx-1 flex justify-end gap-2 bg-background/90 px-1 py-3 backdrop-blur",
          inSheet ? "bottom-0" : "bottom-[calc(3.5rem+env(safe-area-inset-bottom))] md:bottom-0",
        )}
      >
        {onCancel && (
          <Button type="button" variant="ghost" className="h-10 rounded-full px-5" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" className="h-10 rounded-full px-6" disabled={saving || Boolean(duplicate?.sameIsbn)}>
          {saving && <Loader2 className="animate-spin" aria-hidden />}
          {editing ? "Save changes" : "Add book"}
        </Button>
      </div>
    </form>
  );
}

const selectClass =
  "h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

/** "Paste a link" box: reads a publisher's or shop's page and fills the form. */
function PrefillFromLink({ onPrefill, editing }: { onPrefill: (p: Prefill) => { filled: string[]; kept: string[] }; editing: boolean }) {
  const [url, setUrl] = useState("");
  const [loading, startLoading] = useTransition();
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const inputId = useId();

  const run = (link: string) => {
    if (!link.trim()) return;
    setMessage(null);
    startLoading(async () => {
      const r = await prefillFromUrl(link);
      if (!r.ok) {
        setMessage({ kind: "error", text: r.error });
        return;
      }
      const { filled, kept } = onPrefill(r.data);
      if (filled.length === 0) {
        setMessage({ kind: "ok", text: `Nothing new on ${r.data.site}: your fields are already filled.` });
        return;
      }
      const extra = kept.length ? ` Kept your ${kept.join(", ")}.` : "";
      setMessage({ kind: "ok", text: `Filled from ${r.data.site}: ${filled.join(", ")}. Check it, then save.${extra}` });
    });
  };

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-accent/70 p-4 dark:bg-accent/60">
      <label htmlFor={inputId} className="flex items-center gap-2 text-sm font-medium">
        <Link2 className="size-4" aria-hidden />
        {editing ? "Fill in missing details from a link" : "Fill in from a link"}
      </label>
      <div className="flex gap-2">
        <Input
          id={inputId}
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onPaste={(e) => {
            // Pasting a link starts right away.
            const text = e.clipboardData.getData("text").trim();
            if (/^https?:\/\//i.test(text)) {
              e.preventDefault();
              setUrl(text);
              run(text);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              run(url);
            }
          }}
          placeholder="Paste the book's page from a publisher or bookshop"
          className="h-10 bg-background"
        />
        <Button type="button" variant="secondary" className="h-10 rounded-full px-4" onClick={() => run(url)} disabled={loading || !url.trim()}>
          {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Fill in
        </Button>
      </div>
      <p className={cn("text-xs", message?.kind === "error" ? "text-destructive" : "text-muted-foreground")} role={message ? "status" : undefined}>
        {message?.text ?? "Works with most publishers (Лабораторія, Старий Лев, Віват, КСД…). Yakaboo and Наш формат block it."}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-heading text-xl font-semibold text-heading">{title}</h2>
      {children}
    </section>
  );
}

/** Label + control + hint/error, wired together for screen readers. */
function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: FieldError;
  required?: boolean;
  children: (id: string, describedBy: string | undefined) => React.ReactNode;
}) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error?.message ?? hint;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && <span className="text-muted-foreground"> *</span>}
      </label>
      {children(id, note ? noteId : undefined)}
      {note && (
        <p id={noteId} className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")} role={error ? "alert" : undefined}>
          {note}
        </p>
      )}
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-9 rounded-full px-3.5 text-sm font-medium ring-1 ring-border transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            value === o.value && "bg-primary text-primary-foreground ring-primary hover:bg-primary/90",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function DatalistInput({ options, ...props }: React.ComponentProps<"input"> & { options: string[] }) {
  const listId = useId();
  return (
    <>
      <Input list={listId} className="h-10" {...props} />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  );
}

function CoverPicker({
  book,
  title,
  authors,
  file,
  linkedUrl,
  onFile,
  onClearLinked,
}: {
  book?: Book;
  title: string;
  authors: string[];
  file: File | null;
  /** A cover found via "Fill from a link", not saved yet. */
  linkedUrl: string | null;
  onFile: (f: File | null) => void;
  onClearLinked: () => void;
}) {
  const inputId = useId();
  // A temporary URL shows the chosen photo before it's uploaded.
  const [preview, setPreview] = useState<string | null>(null);
  const previewRef = useRef<string | null>(null);
  const choose = (next: File | null) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = next ? URL.createObjectURL(next) : null;
    setPreview(previewRef.current);
    onFile(next);
  };
  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  const src = file ? (preview ?? undefined) : (linkedUrl ?? book?.coverSrc);
  const pending = Boolean(file || linkedUrl);

  return (
    <div className="mx-auto flex w-36 flex-col gap-2 md:mx-0 md:w-full">
      <BookCover title={title || "New book"} authors={authors} src={src} sizes="176px" />
      <label
        htmlFor={inputId}
        className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-full text-sm font-medium ring-1 ring-border hover:bg-muted focus-within:ring-3 focus-within:ring-ring/50"
      >
        <ImagePlus className="size-4" aria-hidden />
        {src ? "Change cover" : "Add cover"}
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="sr-only"
          onChange={(e) => choose(e.target.files?.[0] ?? null)}
        />
      </label>
      {pending && (
        <button
          type="button"
          onClick={() => {
            choose(null);
            onClearLinked();
          }}
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          {book?.coverSrc ? "Keep the old cover" : "Remove this cover"}
        </button>
      )}
    </div>
  );
}
