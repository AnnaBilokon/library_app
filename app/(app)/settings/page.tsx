import type { Metadata } from "next";
import { Suspense } from "react";
import { Download, FileSpreadsheet, LogOut } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { PageHeader } from "@/components/layout/page-header";
import { TrashList } from "@/components/books/trash-list";
import { AuthorCountryList } from "@/components/countries/author-country-list";
import { PalettePicker } from "@/components/layout/palette-picker";
import { ThemePicker } from "@/components/layout/theme-picker";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { authorList } from "@/lib/countries";
import { getAuthorCountries } from "@/lib/data/author-countries";
import { getBooks, getDeletedBooks } from "@/lib/data/books";

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
      <Card id="backup" className="scroll-mt-24">
        <CardHeader>
          <CardTitle>Your data</CardTitle>
          <CardDescription>
            Download a copy of everything, to keep somewhere safe. Your books live only in this app&apos;s database, so a backup now and
            then is a good idea.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {/* Plain links: the browser downloads the file the route sends back. */}
          <a href="/api/export?format=json" download className={buttonVariants({ className: "h-10 rounded-full px-5" })}>
            <Download aria-hidden />
            Full backup (JSON)
          </a>
          <a href="/api/export?format=csv" download className={buttonVariants({ variant: "outline", className: "h-10 rounded-full px-5" })}>
            <FileSpreadsheet aria-hidden />
            Spreadsheet (CSV)
          </a>
          <p className="w-full text-xs text-muted-foreground">
            The backup has every book (the trash too) with readings, reviews and notes, author countries, reading goals and Book Battle
            picks. The spreadsheet opens in Excel or Google Sheets. Covers are included as links.
          </p>
        </CardContent>
      </Card>
      <Card id="author-countries" className="scroll-mt-24">
        <CardHeader>
          <CardTitle>Author countries</CardTitle>
          <CardDescription>Where your authors are from. Books show their flags, and the Dashboard maps the countries you read.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
            <AuthorCountries />
          </Suspense>
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

async function AuthorCountries() {
  const [books, map] = await Promise.all([getBooks(), getAuthorCountries()]);
  return <AuthorCountryList authors={authorList(books, map)} />;
}
