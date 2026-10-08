import { Skeleton } from "@/components/ui/skeleton";

export function LibrarySkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading books">
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 flex-1 basis-64" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-48" />
        <Skeleton className="ml-auto h-9 w-20" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-28 rounded-full" />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
        {Array.from({ length: 14 }, (_, i) => (
          <li key={i} className="flex flex-col gap-2">
            <Skeleton className="aspect-[2/3] w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-3/5" />
          </li>
        ))}
      </ul>
    </div>
  );
}
