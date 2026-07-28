import { ContextNavSkeleton } from "@/components/feedback/loaders/context-nav-skeleton"
import { PageHeaderSkeleton } from "@/components/feedback/loaders/page-header-skeleton"
import { SkeletonCard } from "@/components/ui/skeleton"

export function MovimientoDetailSkeleton({ includeChrome = true }: { includeChrome?: boolean }) {
  const content = (
    <>
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <SkeletonCard tone="low" className="h-44 rounded-[1.75rem]" />
        <SkeletonCard className="h-44 rounded-[1.75rem]" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <SkeletonCard key={item} className="h-32" />
        ))}
      </div>
    </>
  )

  if (!includeChrome) {
    return <section className="flex flex-col gap-6">{content}</section>
  }

  return (
    <div className="flex flex-col gap-5">
      <ContextNavSkeleton />
      <PageHeaderSkeleton module="finanzas" />
      {content}
    </div>
  )
}
