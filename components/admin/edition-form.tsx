"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, type Path, type PathValue } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { importEditionCover, saveEdition } from "@/app/actions/admin";
import { DatalistInput, Field, LANGUAGES, PrefillFromLink, Section, Segmented, selectClass } from "@/components/books/book-form";
import { TagInput } from "@/components/books/tag-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { languageLabel } from "@/lib/books/labels";
import type { Edition } from "@/lib/catalog/editions";
import type { Prefill } from "@/lib/prefill/parse";
import { editionInputSchema, type EditionFormValues, type EditionInput } from "@/lib/schemas";

export interface EditionSuggestions {
  authors: string[];
  genres: string[];
  publishers: string[];
}

function toFormValues(e?: Edition): EditionFormValues {
  return {
    title: e?.title ?? "",
    authors: e?.authors ?? [],
    genres: e?.genres ?? [],
    language: e?.language ?? (e ? "" : "uk"),
    originalLanguage: e?.originalLanguage ?? "",
    publisher: e?.publisher ?? "",
    publishedYear: e?.publishedYear ?? NaN,
    pages: e?.pages ?? NaN,
    isbn: e?.isbn ?? "",
    series: e?.series ?? "",
    seriesIndex: e?.seriesIndex ?? NaN,
    description: e?.description ?? "",
    sourceUrl: e?.sourceUrl ?? "",
    // Editions you add yourself go public straight away; drafts are for suggestions to review.
    status: e?.status ?? "public",
  };
}

/** Add or edit a catalog edition. A new one can start from a publisher's or shop's page. */
export function EditionForm({ edition, hasMyCopy, suggestions }: { edition?: Edition; hasMyCopy: boolean; suggestions: EditionSuggestions }) {
  const router = useRouter();
  const [saving, startSaving] = useTransition();
  const [alsoUpdateMine, setAlsoUpdateMine] = useState(true);
  // A cover found by "Fill from a link"; copied into Storage once the edition is saved.
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const editing = Boolean(edition);

  const form = useForm<EditionFormValues, unknown, EditionInput>({
    resolver: zodResolver(editionInputSchema),
    defaultValues: toFormValues(edition),
    mode: "onTouched",
  });
  const { register, control, handleSubmit, formState } = form;
  const errors = formState.errors;

  /** Fills empty fields from a web page (all fields for a new edition). */
  const applyPrefill = (p: Prefill, link: string) => {
    const filled: string[] = [];
    const kept: string[] = [];
    const isEmpty = (v: unknown) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0) || Number.isNaN(v);
    const fill = <K extends Path<EditionFormValues>>(name: K, value: PathValue<EditionFormValues, K> | undefined, label: string) => {
      if (isEmpty(value)) return;
      if (editing && !isEmpty(form.getValues(name))) return void kept.push(label);
      form.setValue(name, value as PathValue<EditionFormValues, K>, { shouldDirty: true, shouldValidate: true });
      filled.push(label);
    };
    fill("title", p.title, "title");
    fill("authors", p.authors, "authors");
    fill("publisher", p.publisher, "publisher");
    fill("publishedYear", p.publishedYear, "year");
    fill("pages", p.pages, "pages");
    fill("isbn", p.isbn, "ISBN");
    fill("language", p.language, "language");
    fill("description", p.description, "description");
    fill("sourceUrl", link, "source link");
    if (p.coverUrl && (!editing || !edition?.coverSrc)) {
      setCoverUrl(p.coverUrl);
      filled.push("cover");
    }
    return { filled, kept };
  };

  const onSubmit = (values: EditionInput) =>
    startSaving(async () => {
      const r = await saveEdition(edition?.id ?? null, values, editing && hasMyCopy && alsoUpdateMine);
      if (!r.ok) return void toast.error(r.error);
      if (coverUrl) {
        const imported = await importEditionCover(r.data.id, coverUrl);
        if (!imported.ok) toast.warning(imported.error);
        setCoverUrl(null);
      }
      toast.success(editing ? "Saved" : "Added to the catalog");
      if (editing) router.refresh();
      else router.push(`/admin/editions/${r.data.id}`);
    });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-8" noValidate>
      <PrefillFromLink onPrefill={applyPrefill} editing={editing} />
      {coverUrl && <p className="-mt-5 text-sm text-muted-foreground">The cover from that page will be copied when you save.</p>}

      <Section title="The book">
        <Field label="Title" required error={errors.title}>
          {(id, d) => <Input id={id} {...register("title")} aria-describedby={d} aria-invalid={Boolean(errors.title)} className="h-10" />}
        </Field>
        <Field label="Authors" hint="Press Enter after each name.">
          {(id, d) => (
            <Controller
              control={control}
              name="authors"
              render={({ field }) => <TagInput id={id} value={field.value} onChange={field.onChange} suggestions={suggestions.authors} aria-describedby={d} />}
            />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <Field label="Series">{(id) => <Input id={id} {...register("series")} className="h-10" />}</Field>
          <Field label="Number" error={errors.seriesIndex}>
            {(id, d) => <Input id={id} type="number" step="any" inputMode="decimal" {...register("seriesIndex", { valueAsNumber: true })} aria-describedby={d} className="h-10" />}
          </Field>
        </div>
        <Field label="Genres">
          {(id) => (
            <Controller
              control={control}
              name="genres"
              render={({ field }) => <TagInput id={id} value={field.value} onChange={field.onChange} suggestions={suggestions.genres} />}
            />
          )}
        </Field>
        <Field label="About the book">{(id) => <Textarea id={id} rows={6} {...register("description")} />}</Field>
      </Section>

      <Section title="This edition">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ISBN" error={errors.isbn}>
            {(id, d) => <Input id={id} inputMode="numeric" {...register("isbn")} aria-describedby={d} aria-invalid={Boolean(errors.isbn)} className="h-10" />}
          </Field>
          <Field label="Publisher">{(id) => <DatalistInput id={id} {...register("publisher")} options={suggestions.publishers} />}</Field>
          <Field label="Year published" error={errors.publishedYear}>
            {(id, d) => <Input id={id} type="number" inputMode="numeric" {...register("publishedYear", { valueAsNumber: true })} aria-describedby={d} className="h-10" />}
          </Field>
          <Field label="Pages" error={errors.pages}>
            {(id, d) => <Input id={id} type="number" inputMode="numeric" {...register("pages", { valueAsNumber: true })} aria-describedby={d} className="h-10" />}
          </Field>
          {(["language", "originalLanguage"] as const).map((name) => (
            <Field key={name} label={name === "language" ? "Language" : "Original language"} error={errors[name]}>
              {(id) => (
                <select id={id} {...register(name)} className={selectClass}>
                  <option value="">—</option>
                  {LANGUAGES.map((code) => (
                    <option key={code} value={code}>
                      {languageLabel(code)}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          ))}
        </div>
        <Field label="Source page" hint="Where these details came from." error={errors.sourceUrl}>
          {(id, d) => <Input id={id} type="url" inputMode="url" {...register("sourceUrl")} aria-describedby={d} className="h-10" />}
        </Field>
      </Section>

      <Section title="Visibility">
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <Segmented
              label="Visibility"
              value={field.value}
              onChange={field.onChange}
              options={[
                { value: "public", label: "Public: everyone can find it" },
                { value: "draft", label: "Draft: waiting for review" },
              ]}
            />
          )}
        />
      </Section>

      {editing && hasMyCopy && (
        <Section title="Your copy">
          <label className="flex items-start gap-3 text-sm">
            <Checkbox className="mt-0.5" checked={alsoUpdateMine} onCheckedChange={(c) => setAlsoUpdateMine(Boolean(c))} />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">When I save, update my own book too</span>
              <span className="text-muted-foreground">
                Copies these details to your book, and the cover if your book has none. Your shelf, status, rating and notes stay as they are.
              </span>
            </span>
          </label>
        </Section>
      )}

      {/* Always in view while you edit; on phones it sits above the tab bar. */}
      <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10 -mx-1 flex items-center justify-end gap-3 border-t bg-background/90 px-1 py-3 backdrop-blur md:bottom-0">
        {formState.isDirty && <span className="text-sm text-muted-foreground">Unsaved changes</span>}
        <Button type="submit" className="h-10 rounded-full px-6" disabled={saving}>
          {saving && <Loader2 className="animate-spin" aria-hidden />}
          {editing ? "Save changes" : "Add to the catalog"}
        </Button>
      </div>
    </form>
  );
}
