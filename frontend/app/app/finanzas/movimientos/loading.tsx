import { PageHeaderSkeleton } from "@/components/feedback/loaders/page-header-skeleton"
import { MovimientosSkeleton } from "@/modules/finanzas/components/skeletons/movimientos-skeleton"

export default function MovimientosLoading() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeaderSkeleton module="finanzas" hasActions />
      <MovimientosSkeleton />
    </div>
  )
}
