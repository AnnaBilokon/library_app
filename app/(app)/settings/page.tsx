import type { Metadata } from "next";
import { Suspense } from "react";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { PageHeader } from "@/components/layout/page-header";
import { TrashList } from "@/components/books/trash-list";
import { PalettePicker } from "@/components/layout/palette-picker";
import { ThemePicker } from "@/components/layout/theme-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { getDeletedBooks } from "@/lib/data/books";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pt-6 pb-12 md:px-8 md:pt-10">
      <PageHeader eyebrow="Preferences" title="Settings" />
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Mode and colours. System follows your device&apos;s light or dark setting.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <ThemePicker />
          <PalettePicker />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Trash</CardTitle>
          <CardDescription>Books you removed. Restore them, or delete them forever.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
            <Trash />
          </Suspense>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <Suspense fallback={<CardDescription>&nbsp;</CardDescription>}>
            <SignedInAs />
          </Suspense>
        </CardHeader>
        <CardContent>
          <form action={signOut}>
            <Button type="submit" variant="outline">
              <LogOut aria-hidden />
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">Yearly goal and export arrive in later phases.</p>
    </main>
  );
}

async function SignedInAs() {
  const user = await requireUser();
  return <CardDescription>Signed in as {user.email}</CardDescription>;
}

async function Trash() {
  return <TrashList books={await getDeletedBooks()} />;
}
