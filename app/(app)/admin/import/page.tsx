import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ImportList } from "@/components/admin/import-list";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Import a list" };

export default function ImportPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pt-6 pb-12 md:px-8 md:pt-10">
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <Import />
      </Suspense>
    </main>
  );
}

async function Import() {
  await requireAdmin();
  return (
    <>
      <Link href="/admin" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground focus-visible:underline focus-visible:outline-none">
        <ArrowLeft className="size-4" aria-hidden />
        Catalog
      </Link>
      <PageHeader
        eyebrow="Catalog"
        title="Import a list"
        description="Paste links to book pages (publishers, bookshops) or ISBNs. Each one becomes a draft in To review: nobody else can find it until you check it and approve it."
      />
      <ImportList hasGoogleKey={Boolean(process.env.GOOGLE_BOOKS_API_KEY)} />
    </>
  );
}
