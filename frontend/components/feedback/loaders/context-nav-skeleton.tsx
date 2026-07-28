import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export function ContextNavSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "-mx-4 sticky top-16 z-20 border-b border-white/30 bg-background px-4 py-3 sm:-mx-8 sm:px-8 md:static md:top-auto md:z-auto md:m-0 md:border-0 md:bg-transparent md:px-0 md:py-0",
        className
      )}
    >
      <div className="flex min-w-max items-center gap-2">
        <Skeleton className="h-4 w-14 rounded-full" />
        <Skeleton className="size-1.5 rounded-full" />
        <Skeleton className="h-4 w-28 rounded-full" />
      </div>
    </div>
  )
}
