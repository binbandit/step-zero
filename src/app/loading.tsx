import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-x-0 top-0 h-72 bg-gradient-to-b from-primary/[0.04] to-transparent pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-6 py-12">
        {/* Header skeleton */}
        <header className="mb-12">
          <div className="flex items-center gap-3 mb-3">
            <Skeleton className="size-10 rounded-xl" />
            <Skeleton className="h-6 w-36" />
          </div>
          <Skeleton className="h-4 w-80 mt-3" />
        </header>

        {/* Actions bar skeleton */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-5 w-8 rounded-full" />
          </div>
          <Skeleton className="h-8 w-28 rounded-md" />
        </div>

        <Skeleton className="h-px w-full mb-8" />

        {/* Cards grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/50 bg-card/50 p-0">
              <div className="p-6 pb-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </div>
              <div className="px-6 pb-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3 mt-2" />
              </div>
              <div className="px-6 pb-6 pt-0 flex items-center justify-between">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
