import { PageHeaderSkeleton } from "@/components/feedback/loaders/page-header-skeleton"
import { SkeletonCard } from "@/components/ui/skeleton"

export default function DeudasLoading() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeaderSkeleton module="finanzas" />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <SkeletonCard className="h-28" />
          <SkeletonCard className="h-28" />
        </div>
        <SkeletonCard className="h-32" />
      </div>
    </div>
  )
}
