import { Skeleton } from "@/components/ui/skeleton";

export default function ReviewLoading() {
  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header skeleton */}
      <div className="h-14 border-b border-border/50 flex items-center px-4 gap-4 shrink-0">
        <Skeleton className="size-8 rounded-md" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-40" />
        <div className="flex-1" />
        <Skeleton className="h-4 w-20" />
      </div>

      {/* Body: sidebar + diff area */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar skeleton */}
        <div className="w-64 border-r border-border/30 p-3 flex flex-col gap-2 shrink-0">
          <Skeleton className="h-3 w-20 mb-2" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>

        {/* Diff area skeleton */}
        <div className="flex-1 p-4 flex flex-col gap-3">
          <Skeleton className="h-8 w-full" />
          {Array.from({ length: 15 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      </div>

      {/* Footer skeleton */}
      <div className="h-14 border-t border-border/50 flex items-center px-4 gap-4 shrink-0">
        <Skeleton className="h-7 w-32" />
        <div className="flex-1" />
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-24" />
      </div>
    </div>
  );
}
