import { PageHeaderSkeleton } from "@/components/feedback/loaders/page-header-skeleton"
import { CuentasSkeleton } from "@/modules/finanzas/components/skeletons/cuentas-skeleton"

export default function CuentasLoading() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeaderSkeleton module="finanzas" hasActions />
      <CuentasSkeleton />
    </div>
  )
}
