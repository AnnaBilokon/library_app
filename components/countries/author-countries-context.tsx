"use client";

import { createContext, use } from "react";
import { bookCountries, type AuthorCountries } from "@/lib/countries";
import { Flags } from "./flag";

const AuthorCountriesContext = createContext<AuthorCountries | null>(null);

/** Pages that show books wrap them in this, so any card can show its authors' flags. */
export function AuthorCountriesProvider({ value, children }: { value: AuthorCountries; children: React.ReactNode }) {
  return <AuthorCountriesContext value={value}>{children}</AuthorCountriesContext>;
}

/** The flags for a list of authors (each country once); nothing outside a provider or without countries. */
export function AuthorFlags({ authors, className }: { authors: string[]; className?: string }) {
  const map = use(AuthorCountriesContext);
  if (!map) return null;
  return <Flags codes={bookCountries({ authors }, map)} className={className} />;
}
