import { PageHeaderSkeleton } from "@/components/feedback/loaders/page-header-skeleton"
import { SkeletonCard } from "@/components/ui/skeleton"

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <PageHeaderSkeleton />
      <div className="h-64 animate-pulse rounded-2xl bg-[color:var(--hero)] opacity-80 sm:h-56" />
      <section className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {["finanzas", "entrenamientos", "nutricion", "compras"].map((module) => (
          <div
            key={module}
            className="h-36 animate-pulse rounded-2xl opacity-70 sm:h-40"
            style={{ background: `var(--module-${module}-fill)` }}
          />
        ))}
      </section>
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {[1, 2, 3, 4].map((item) => (
          <SkeletonCard key={item} className="h-14" />
        ))}
      </section>
    </div>
  )
}
