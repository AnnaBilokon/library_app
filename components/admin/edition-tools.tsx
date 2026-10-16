"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, GitMerge, ImageUp, Link2, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteEdition, findEditions, importEditionCover, mergeEdition, reviewEdition, uploadEditionCover, type EditionOption } from "@/app/actions/admin";
import { BookCover } from "@/components/books/book-cover";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/books/labels";
import type { Edition } from "@/lib/catalog/editions";
import { cn } from "@/lib/utils";

/**
 * For an edition waiting in the review queue: check it, then mark it reviewed (a draft from
 * someone else gets published at the same time) and go back to the queue.
 */
export function ReviewBanner({ edition }: { edition: Edition }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (edition.reviewedAt) return null;
  const draft = edition.status === "draft";

  const review = () =>
    start(async () => {
      const r = await reviewEdition(edition.id, draft);
      if (!r.ok) return void toast.error(r.error);
      toast.success(draft ? "Approved and published" : "Marked as reviewed");
      router.push("/admin?filter=to-review");
    });

  return (
    <div role="note" className="flex flex-col gap-3 rounded-2xl bg-accent/80 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-0.5 text-sm">
        <p className="font-medium">
          Added from {draft ? "someone's" : "a"} book on {formatDate(edition.createdAt.slice(0, 10))} · not reviewed yet
        </p>
        <p className="text-muted-foreground">
          {draft
            ? "Only its author can see it until you approve it. Check the details and cover first."
            : "Check the details and cover, fix anything below, then mark it reviewed. Saving the form counts too."}
        </p>
      </div>
      <Button onClick={review} disabled={pending} className="h-10 shrink-0 rounded-full px-5">
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <CircleCheck aria-hidden />}
        {draft ? "Approve & publish" : "Mark as reviewed"}
      </Button>
    </div>
  );
}

/** The edition's cover: upload a file or copy one from a link. */
export function EditionCover({ edition }: { edition: Edition }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [url, setUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const done = (r: { ok: boolean; error?: string }, success: string) => {
    if (r.ok) {
      toast.success(success);
      setUrl("");
      router.refresh();
    } else toast.error(r.error);
  };

  return (
    <div className="flex flex-col gap-3">
      <BookCover title={edition.title} authors={edition.authors} src={edition.coverSrc} lang={edition.language} sizes="(min-width: 768px) 224px, 160px" />
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const fd = new FormData();
          fd.set("cover", file);
          start(async () => done(await uploadEditionCover(edition.id, fd), "Cover uploaded"));
          e.target.value = "";
        }}
      />
      <Button type="button" variant="outline" className="rounded-full" disabled={pending} onClick={() => fileRef.current?.click()}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <ImageUp aria-hidden />}
        Upload a cover
      </Button>
      <div className="flex gap-2">
        <Input
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="…or paste an image link"
          aria-label="Cover image link"
          className="h-9"
        />
        <Button
          type="button"
          variant="secondary"
          size="icon-lg"
          aria-label="Copy the cover from this link"
          disabled={pending || !url.trim()}
          onClick={() => start(async () => done(await importEditionCover(edition.id, url.trim()), "Cover copied"))}
        >
          <Link2 aria-hidden />
        </Button>
      </div>
    </div>
  );
}

/** Merge this edition into another (moving every linked book), or delete it when nothing links to it. */
export function EditionDangerZone({ edition, copies }: { edition: Edition; copies: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [query, setQuery] = useState(edition.title);
  const [options, setOptions] = useState<EditionOption[] | null>(null);
  const [target, setTarget] = useState<EditionOption | null>(null);
  const [searching, startSearch] = useTransition();

  const search = () =>
    startSearch(async () => {
      const r = await findEditions(query, edition.id);
      if (r.ok) setOptions(r.data);
      else toast.error(r.error);
    });

  const merge = () =>
    target &&
    start(async () => {
      const r = await mergeEdition(edition.id, target.id);
      if (!r.ok) return void toast.error(r.error);
      toast.success(`Merged into “${target.title}”`);
      router.push(`/admin/editions/${target.id}`);
    });

  const remove = () =>
    start(async () => {
      const r = await deleteEdition(edition.id);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Deleted from the catalog");
      router.push("/admin");
    });

  return (
    <div className="flex flex-wrap gap-2">
      <Dialog onOpenChange={(open) => open && !options && search()}>
        <DialogTrigger render={<Button variant="outline" className="rounded-full" />}>
          <GitMerge aria-hidden />
          Merge into another edition…
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Merge into another edition</DialogTitle>
            <DialogDescription>
              {copies === 1 ? "The book linked here moves" : `All ${copies} books linked here move`} to the edition you pick, and this one is deleted. Their own details don&apos;t change.
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              search();
            }}
          >
            <Input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search the catalog" placeholder="Title, author or ISBN" className="h-9" />
            <Button type="submit" variant="secondary" disabled={searching}>
              {searching && <Loader2 className="animate-spin" aria-hidden />}
              Search
            </Button>
          </form>
          <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto" aria-label="Editions">
            {options?.length === 0 && <li className="p-2 text-sm text-muted-foreground">Nothing found.</li>}
            {options?.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => setTarget(o)}
                  aria-pressed={target?.id === o.id}
                  className={cn("flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm hover:bg-muted", target?.id === o.id && "bg-accent ring-1 ring-primary")}
                >
                  <span className="font-medium">{o.title}</span>
                  <span className="text-muted-foreground">
                    {[o.authors.join(", "), o.publisher, o.publishedYear, o.isbn].filter(Boolean).join(" · ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
            <Button onClick={merge} disabled={!target || pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              Merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog>
        <DialogTrigger render={<Button variant="destructive" className="rounded-full" disabled={copies > 0} />}>
          <Trash2 aria-hidden />
          Delete
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{edition.title}” from the catalog?</DialogTitle>
            <DialogDescription>No one&apos;s book links to it. This can&apos;t be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
            <Button variant="destructive" onClick={remove} disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {copies > 0 && <p className="w-full text-xs text-muted-foreground">Delete is off while books link to it; merge it instead.</p>}
    </div>
  );
}
