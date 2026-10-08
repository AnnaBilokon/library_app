import type { Database } from "@/lib/database.types";

type Enums = Database["public"]["Enums"];

export type BookStatus = Enums["book_status"];
export type BookFormat = Enums["book_format"];
export type WishPriority = Enums["wish_priority"];
export type ReadingOutcome = Enums["reading_outcome"];

export const BOOK_STATUSES = ["to-read", "reading", "paused", "finished", "abandoned"] as const satisfies readonly BookStatus[];
export const BOOK_FORMATS = ["paper", "ebook", "audio"] as const satisfies readonly BookFormat[];

export interface Reading {
  id: string;
  startedAt?: string;
  finishedAt?: string;
  outcome?: ReadingOutcome;
}

/** A book as the app sees it (camelCase, no nulls). Built from DB rows in lib/books/mapping.ts. */
export interface Book {
  id: string;
  title: string;
  authors: string[];
  status: BookStatus;
  favorite: boolean;
  rating?: number;
  /** Ready-to-use image URL: our Storage copy, else the external link. */
  coverSrc?: string;
  isbn?: string;
  genres: string[];
  tags: string[];
  language?: string;
  originalLanguage?: string;
  format?: BookFormat;
  publisher?: string;
  publishedYear?: number;
  pages?: number;
  series?: string;
  seriesIndex?: number;
  notes?: string;

  owned: boolean;
  acquiredAt?: string;
  purchasePrice?: number;
  soldAt?: string;
  salePrice?: number;
  currency: string;

  wanted: boolean;
  priority?: WishPriority;
  wishPrice?: number;
  whereToBuy?: string;
  wishlistReason?: string;

  /** Oldest first. */
  readings: Reading[];
  /** Most recent finish date across readings, for sorting and the "year finished" filter. */
  lastFinishedAt?: string;
  /** Number of finished readings (dated or not). */
  timesRead: number;

  createdAt: string;
  updatedAt: string;
}
