import { PageHeaderSkeleton } from "@/components/feedback/loaders/page-header-skeleton"
import { SkeletonCard } from "@/components/ui/skeleton"

export default function DeudaDetalleLoading() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeaderSkeleton module="finanzas" />
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        <SkeletonCard className="h-40" />
        <SkeletonCard className="h-48" />
      </div>
    </div>
  )
}
