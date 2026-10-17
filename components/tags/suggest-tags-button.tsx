"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { suggestTagsForDraft } from "@/app/actions/tags";

interface Draft {
  title: string;
  authors: string[];
  genres: string[];
  description?: string;
  tags: string[];
}

/** "Suggest tags" under a book form's Tags field: Claude picks from your tag list; you can remove any. */
export function SuggestTagsButton({ getDraft, onAdd }: { getDraft: () => Draft; onAdd: (tags: string[]) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await suggestTagsForDraft(getDraft());
          if (!r.ok) {
            // No tag list yet: offer the way to set one up.
            toast.error(r.error, r.error.includes("tag list") ? { action: { label: "Tags page", onClick: () => router.push("/tags") } } : undefined);
            return;
          }
          if (r.data.length === 0) return void toast.info("No tag from your list fits this one clearly.");
          onAdd(r.data);
          toast.success(`Added ${r.data.join(", ")}`);
        })
      }
      className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline disabled:opacity-60 dark:text-highlight"
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Sparkles className="size-3.5" aria-hidden />}
      Suggest tags
    </button>
  );
}
