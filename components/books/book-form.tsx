"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch, type FieldError } from "react-hook-form";
import { Heart, ImagePlus, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { createBook, updateBook, uploadCover } from "@/app/actions/books";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { duplicateKey } from "@/lib/books/duplicates";
import { FORMAT_LABEL, languageLabel, STATUS_LABEL } from "@/lib/books/labels";
import { normalizeIsbn } from "@/lib/isbn";
import { bookInputSchema, type BookFormValues, type BookInput } from "@/lib/schemas";
import { BOOK_FORMATS, BOOK_STATUSES, type Book } from "@/lib/types";
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
  startedAt: "",
  finishedAt: "",
};

interface BookFormProps {
  suggestions: BookFormSuggestions;
  /** Editing an existing book; without it the form creates a new one. */
  book?: Book;
  onDone?: () => void;
  onCancel?: () => void;
  /** In a full page the save bar must clear the phone's bottom tab bar; in a sheet it doesn't. */
  inSheet?: boolean;
}

export function BookForm({ suggestions, book, onDone, onCancel, inSheet }: BookFormProps) {
  const router = useRouter();
  const [saving, startSaving] = useTransition();
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const editing = Boolean(book);

  // react-hook-form keeps field state outside React state (like a ref), so typing doesn't
  // re-render the whole form; zodResolver runs the same schema the server uses.
  const form = useForm<BookFormValues, unknown, BookInput>({
    resolver: zodResolver(bookInputSchema),
    defaultValues: book ? bookToFormValues(book) : EMPTY,
    mode: "onTouched",
  });
  const { register, control, handleSubmit, formState } = form;
  const errors = formState.errors;

  // useWatch re-renders only when these fields change.
  const [status, title, authors, isbn] = useWatch({ control, name: ["status", "title", "authors", "isbn"] });

  const duplicate = useMemo(() => {
    const others = suggestions.existing.filter((b) => b.id !== book?.id);
    const normalized = isbn ? normalizeIsbn(isbn) : null;
    if (normalized) {
      const sameIsbn = others.find((b) => b.isbn === normalized);
      if (sameIsbn) return { book: sameIsbn, reason: "the same ISBN" };
    }
    if (title.trim() && authors.length) {
      const key = duplicateKey({ title, authors });
      const same = others.find((b) => duplicateKey(b) === key);
      if (same) return { book: same, reason: "the same title and author" };
    }
    return null;
  }, [suggestions.existing, book?.id, isbn, title, authors]);

  const onSubmit = (values: BookInput) =>
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
      }
      toast.success(book ? "Saved" : `Added “${values.title}”`);
      if (book) onDone?.();
      else router.push(`/books/${bookId}`);
    });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-8">
      <div className="grid gap-8 md:grid-cols-[11rem_1fr]">
        <CoverPicker book={book} title={title} authors={authors} file={coverFile} onFile={setCoverFile} />

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
                You already have a book with {duplicate.reason}:{" "}
                <a href={`/books/${duplicate.book.id}`} target="_blank" rel="noreferrer" className="font-medium underline">
                  {duplicate.book.title}
                </a>
                . You can still save it, e.g. for a second copy.
              </span>
            </p>
          )}

          <Field label="Status">
            {() => (
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Segmented
                    label="Status"
                    value={field.value}
                    onChange={field.onChange}
                    options={BOOK_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
                  />
                )}
              />
            )}
          </Field>

          {!editing && status !== "to-read" && (
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
                    field.value && "bg-primary text-primary-foreground ring-primary hover:bg-primary/90",
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
                <Checkbox checked={field.value} onCheckedChange={(c) => field.onChange(Boolean(c))} />
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
        <Button type="submit" className="h-10 rounded-full px-6" disabled={saving}>
          {saving && <Loader2 className="animate-spin" aria-hidden />}
          {editing ? "Save changes" : "Add book"}
        </Button>
      </div>
    </form>
  );
}

const selectClass =
  "h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

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
  onFile,
}: {
  book?: Book;
  title: string;
  authors: string[];
  file: File | null;
  onFile: (f: File | null) => void;
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

  const src = file ? (preview ?? undefined) : book?.coverSrc;

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
          capture="environment"
          className="sr-only"
          onChange={(e) => choose(e.target.files?.[0] ?? null)}
        />
      </label>
      {file && (
        <button type="button" onClick={() => choose(null)} className="text-xs text-muted-foreground underline-offset-4 hover:underline">
          Keep the old cover
        </button>
      )}
    </div>
  );
}
