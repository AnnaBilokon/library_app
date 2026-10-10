import type { Database } from "@/lib/database.types";
import type { Book, Reading } from "@/lib/types";

type BookRow = Database["public"]["Tables"]["books"]["Row"];
type ReadingRow = Pick<
  Database["public"]["Tables"]["readings"]["Row"],
  "id" | "started_at" | "finished_at" | "outcome" | "created_at" | "progress_page" | "progress_percent" | "progress_updated_at" | "stop_reason" | "rating"
>;

export type BookRowWithReadings = BookRow & { readings: ReadingRow[] };

/** null → undefined, so optional fields are simply absent. */
const opt = <T>(value: T | null): T | undefined => value ?? undefined;

export function coverPublicUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl}/storage/v1/object/public/covers/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/** The single place where DB rows (snake_case) become app Books (camelCase). */
export function rowToBook(row: BookRowWithReadings, supabaseUrl: string): Book {
  const readings: Reading[] = [...row.readings]
    .sort((a, b) => (a.started_at ?? a.created_at).localeCompare(b.started_at ?? b.created_at))
    .map((r) => ({
      id: r.id,
      startedAt: opt(r.started_at),
      finishedAt: opt(r.finished_at),
      outcome: opt(r.outcome),
      progressPage: opt(r.progress_page),
      progressPercent: opt(r.progress_percent),
      progressUpdatedAt: opt(r.progress_updated_at),
      stopReason: opt(r.stop_reason),
      rating: opt(r.rating),
    }));

  const finishDates = readings.map((r) => r.finishedAt).filter((d): d is string => Boolean(d));

  return {
    id: row.id,
    title: row.title,
    authors: row.authors,
    status: row.status,
    favorite: row.favorite,
    rating: opt(row.rating),
    coverSrc: row.cover_path ? coverPublicUrl(supabaseUrl, row.cover_path) : opt(row.cover_url),
    isbn: opt(row.isbn),
    genres: row.genres,
    tags: row.tags,
    language: opt(row.language),
    originalLanguage: opt(row.original_language),
    format: opt(row.format),
    publisher: opt(row.publisher),
    publishedYear: opt(row.published_year),
    pages: opt(row.pages),
    series: opt(row.series),
    seriesIndex: opt(row.series_index),
    notes: opt(row.notes),
    review: opt(row.review),
    description: opt(row.description),
    owned: row.owned,
    acquiredAt: opt(row.acquired_at),
    purchasePrice: opt(row.purchase_price),
    forSale: row.for_sale,
    forgotten: row.forgotten,
    soldAt: opt(row.sold_at),
    salePrice: opt(row.sale_price),
    saleOriginalPrice: opt(row.sale_original_price),
    saleOriginalCurrency: opt(row.sale_original_currency),
    currency: row.currency,
    wanted: row.wanted,
    priority: opt(row.priority),
    wishPrice: opt(row.wish_price),
    whereToBuy: opt(row.where_to_buy),
    wishlistReason: opt(row.wishlist_reason),
    queuePosition: opt(row.queue_position),
    readings,
    lastFinishedAt: finishDates.sort().at(-1),
    timesRead: readings.filter((r) => r.outcome === "finished").length,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
