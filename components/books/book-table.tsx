"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  columnVisibilityFeature,
  createColumnHelper,
  tableFeatures,
  useTable,
  type ColumnVisibilityState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SortDir, SortKey } from "@/lib/books/filters";
import { FORMAT_LABEL, formatDate, languageLabel } from "@/lib/books/labels";
import type { Book } from "@/lib/types";
import { cn } from "@/lib/utils";
import { COLUMNS_COOKIE } from "@/lib/books/layout";
import { BookCover } from "./book-cover";
import { StatusBadge } from "./status-badge";

// Features, helper and columns live at module scope so they stay the same object between
// renders (TanStack Table recomputes everything when they change).
const features = tableFeatures({ columnVisibilityFeature });
const helper = createColumnHelper<typeof features, Book>();

/** Which URL sort key a column header sets, if it's sortable. */
const COLUMN_SORT: Partial<Record<string, SortKey>> = {
  title: "title",
  authors: "author",
  publishedYear: "published",
  pages: "pages",
  rating: "rating",
  lastFinishedAt: "finished",
  acquiredAt: "added",
};

const columns = helper.columns([
  helper.display({
    id: "cover",
    header: () => <span className="sr-only">Cover</span>,
    enableHiding: false,
    cell: ({ row }) => (
      <BookCover title={row.original.title} src={row.original.coverSrc} sizes="40px" className="w-9 rounded-sm" />
    ),
  }),
  helper.accessor("title", {
    header: "Title",
    enableHiding: false,
    cell: ({ row }) => (
      <Link
        href={`/books/${row.original.id}`}
        lang={row.original.language}
        className="font-medium hover:underline focus-visible:underline focus-visible:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {row.original.title}
        {row.original.favorite && <Heart className="ml-1 inline size-3 fill-current text-primary" aria-label="Favourite" />}
      </Link>
    ),
  }),
  helper.accessor("authors", { header: "Author", cell: ({ getValue }) => getValue().join(", ") }),
  helper.accessor("status", { header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue()} /> }),
  helper.accessor("genres", { header: "Genre", cell: ({ getValue }) => getValue().join(", ") }),
  helper.accessor("publisher", { header: "Publisher" }),
  helper.accessor("publishedYear", { header: "Year" }),
  helper.accessor("pages", { header: "Pages" }),
  helper.accessor("language", { header: "Language", cell: ({ getValue }) => (getValue() ? languageLabel(getValue()!) : "") }),
  helper.accessor("format", { header: "Format", cell: ({ getValue }) => (getValue() ? FORMAT_LABEL[getValue()!] : "") }),
  helper.accessor("rating", { header: "Rating", cell: ({ getValue }) => (getValue() !== undefined ? `${getValue()} ★` : "") }),
  helper.accessor("owned", { header: "Owned", cell: ({ getValue }) => (getValue() ? "Yes" : "No") }),
  helper.accessor("lastFinishedAt", { header: "Finished", cell: ({ getValue }) => (getValue() ? formatDate(getValue()!) : "") }),
  helper.accessor("acquiredAt", { header: "Added", cell: ({ getValue }) => (getValue() ? formatDate(getValue()!) : "") }),
]);

interface BookTableProps {
  books: Book[];
  sort: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  /** Saved column choices, read from a cookie on the server so the first render is already right. */
  initialColumns: ColumnVisibilityState;
}

export function BookTable({ books, sort, dir, onSort, initialColumns }: BookTableProps) {
  const router = useRouter();
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>(initialColumns);

  useEffect(() => {
    document.cookie = `${COLUMNS_COOKIE}=${encodeURIComponent(JSON.stringify(columnVisibility))}; path=/; max-age=31536000; samesite=lax`;
  }, [columnVisibility]);

  const table = useTable({
    features,
    columns,
    data: books,
    getRowId: (row) => row.id,
    state: { columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
            <Columns3 aria-hidden />
            Columns
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Show columns</DropdownMenuLabel>
              {table
                .getAllLeafColumns()
                .filter((c) => c.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(checked) => column.toggleVisibility(Boolean(checked))}
                    closeOnClick={false}
                  >
                    {typeof column.columnDef.header === "string" ? column.columnDef.header : column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => {
                  const sortKey = COLUMN_SORT[header.column.id];
                  const active = sortKey === sort;
                  return (
                    <TableHead
                      key={header.id}
                      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}
                      className={cn(header.column.id === "cover" && "w-12")}
                    >
                      {sortKey ? (
                        <button
                          type="button"
                          onClick={() => onSort(sortKey)}
                          className="-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                        >
                          <table.FlexRender header={header} />
                          {active ? (
                            dir === "asc" ? <ArrowUp className="size-3.5" aria-hidden /> : <ArrowDown className="size-3.5" aria-hidden />
                          ) : (
                            <ArrowUpDown className="size-3.5 opacity-40" aria-hidden />
                          )}
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className="cursor-pointer" onClick={() => router.push(`/books/${row.id}`)}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className={cn("max-w-64 truncate", cell.column.id === "cover" && "py-1.5")}>
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
