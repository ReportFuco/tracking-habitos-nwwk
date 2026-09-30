import { PageHeaderSkeleton } from "@/components/feedback/loaders/page-header-skeleton"
import { SkeletonCard } from "@/components/ui/skeleton"

export default function CategoriasLoading() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeaderSkeleton module="finanzas" />
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        <SkeletonCard className="h-48" />
        <SkeletonCard className="h-28" />
      </div>
    </div>
  )
}
