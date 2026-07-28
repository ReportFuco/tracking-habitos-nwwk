import { PageHeaderSkeleton } from "@/components/feedback/loaders/page-header-skeleton"
import { SkeletonCard } from "@/components/ui/skeleton"
import { FinanzasKpiOverviewSkeleton } from "@/modules/finanzas/components/skeletons/kpi-overview-skeleton"

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeaderSkeleton module="finanzas" hasActions />
      <FinanzasKpiOverviewSkeleton />
      <section className="grid gap-3 sm:grid-cols-3 sm:gap-4">
        {[1, 2, 3].map((item) => (
          <SkeletonCard key={item} className="h-32" />
        ))}
      </section>
    </div>
  )
}
