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
  /** Current page (open reading) or where you stopped (did not finish). */
  progressPage?: number;
  /** Same, as a percentage, when you track by % instead of pages. */
  progressPercent?: number;
  progressUpdatedAt?: string;
  /** Why you stopped (did not finish). */
  stopReason?: string;
  /** Your rating for this reading (re-reads can differ). */
  rating?: number;
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
  /** Your personal review. */
  review?: string;
  /** What the book is about (publisher's blurb or your own). */
  description?: string;

  owned: boolean;
  acquiredAt?: string;
  purchasePrice?: number;
  /** In the Forgotten box: "Surprise me" can pick it to remind you. */
  forgotten: boolean;
  /** On the sell shelf: you own it and want to sell it. */
  forSale: boolean;
  /** Set once sold; a sold book leaves the library but stays on the Sell page. */
  soldAt?: string;
  salePrice?: number;
  /** What it actually sold for when that was in another currency (salePrice is the converted value). */
  saleOriginalPrice?: number;
  saleOriginalCurrency?: string;
  currency: string;

  wanted: boolean;
  priority?: WishPriority;
  wishPrice?: number;
  /** Wishlist: the day it comes out (yyyy-mm-dd). */
  releaseDate?: string;
  whereToBuy?: string;
  wishlistReason?: string;

  /** Place in the "Up next" queue (1 = pinned next read); absent when not queued. */
  queuePosition?: number;

  /** Oldest first. */
  readings: Reading[];
  /** Most recent finish date across readings, for sorting and the "year finished" filter. */
  lastFinishedAt?: string;
  /** Number of finished readings (dated or not). */
  timesRead: number;

  createdAt: string;
  updatedAt: string;
}
