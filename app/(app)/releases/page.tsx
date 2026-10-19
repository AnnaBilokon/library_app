import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ReleasesView } from "@/components/releases/releases-view";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";
import { getReleasePicks } from "@/lib/data/release-picks";
import { getReleases, getReleaseSources } from "@/lib/data/releases";

export const metadata: Metadata = { title: "New releases" };

// The check reads up to 20 pages of a listing in one Server Action.
export const maxDuration = 120;

export default function ReleasesPage() {
  return (
    <main className="mx-auto flex w-full max-w-screen-2xl flex-col gap-8 px-4 pt-6 pb-12 md:px-8 md:pt-10">
      <PageHeader eyebrow="Books to get" title="New releases" description="New and upcoming books from publishers' pages, ready to add to your library or wishlist." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <Releases />
      </Suspense>
    </main>
  );
}

async function Releases() {
  const [user, releases, sources, picks] = await Promise.all([requireUser(), getReleases(), getReleaseSources(), getReleasePicks()]);
  return (
    <ReleasesView
      releases={releases}
      sources={sources}
      isAdmin={user.isAdmin}
      picks={picks.map((p) => ({ editionId: p.edition.id, reason: p.reason, seen: p.seen }))}
      today={new Date().toISOString().slice(0, 10)}
    />
  );
}
