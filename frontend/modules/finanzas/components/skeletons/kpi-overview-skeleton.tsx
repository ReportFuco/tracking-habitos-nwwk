import { Skeleton, SkeletonCard } from "@/components/ui/skeleton"

export function FinanzasKpiOverviewSkeleton() {
  return (
    <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="rounded-[1.75rem] bg-[color:var(--surface-low)] p-4 sm:p-6">
        <div className="rounded-[1.5rem] bg-[linear-gradient(135deg,color-mix(in_oklch,var(--module-finanzas)_12%,white),transparent_72%)] p-5 shadow-[var(--shadow-airy-lg)] sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-32 rounded-full" />
              <Skeleton className="mt-3 h-10 w-3/4 rounded-[1rem] sm:h-12" />
              <Skeleton className="mt-3 h-4 w-full max-w-lg rounded-full" />
              <Skeleton className="mt-2 h-4 w-2/3 rounded-full" />
            </div>
            <div
              className="h-8 w-32 rounded-full"
              style={{
                background: "color-mix(in oklch, var(--module-finanzas) 12%, transparent)",
              }}
            />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <SkeletonCard key={item} className="h-24 rounded-[1.25rem]" />
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2 sm:flex-1">
              <Skeleton className="h-4 w-full rounded-full" />
              <Skeleton className="h-4 w-3/4 rounded-full" />
            </div>
            <Skeleton className="h-11 w-full rounded-xl sm:w-32" />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
        {[1, 2].map((item) => (
          <SkeletonCard key={item} className="h-56 rounded-[1.75rem] p-5 sm:p-6" />
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:col-span-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <SkeletonCard key={item} className="h-32" />
        ))}
      </div>
    </section>
  )
}
