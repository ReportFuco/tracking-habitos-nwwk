import { ContextNavSkeleton } from "@/components/feedback/loaders/context-nav-skeleton"
import { PageHeaderSkeleton } from "@/components/feedback/loaders/page-header-skeleton"
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton"

type ModuleTone = "finanzas" | "entrenamientos" | "nutricion" | "compras" | "neutral"

export function AuthShellSkeleton({ accent = "olive" }: { accent?: "olive" | "brick" }) {
  const accentColor = accent === "brick" ? "var(--tertiary)" : "var(--primary)"

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(66,81,47,0.12),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(132,49,31,0.08),transparent_28%)]" />
      <div className="relative mx-auto grid min-h-screen w-full max-w-7xl items-stretch gap-6 px-4 pb-6 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-6">
        <section className="relative hidden min-h-[320px] flex-col justify-between overflow-hidden rounded-[2rem] bg-[color:var(--surface-low)] px-6 py-8 shadow-[var(--shadow-airy)] sm:px-8 sm:py-10 lg:flex lg:px-12 lg:py-12">
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, color-mix(in oklch, ${accentColor} 14%, transparent), transparent 72%)`,
            }}
          />
          <div className="relative flex items-start justify-between">
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton tone="lowest" className="h-9 w-20 rounded-full" />
          </div>
          <div className="relative max-w-xl space-y-5">
            <Skeleton className="h-4 w-36 rounded-full" />
            <Skeleton className="h-14 w-full max-w-lg rounded-[1.25rem]" />
            <Skeleton className="h-14 w-4/5 rounded-[1.25rem]" />
            <Skeleton className="h-5 w-3/4 rounded-full" />
          </div>
          <div className="relative grid gap-4 sm:grid-cols-2">
            <SkeletonCard className="h-32" />
            <SkeletonCard className="h-32" tone="low" />
          </div>
        </section>

        <section className="flex items-start justify-center pt-24 lg:items-center lg:justify-end lg:pt-0">
          <SkeletonCard className="w-full max-w-xl rounded-[1.75rem] p-4 sm:rounded-[2rem] sm:p-6 lg:p-8">
            <div className="space-y-5 sm:space-y-6">
              <div className="space-y-3">
                <Skeleton className="h-4 w-28 rounded-full" />
                <Skeleton className="h-8 w-4/5 rounded-[1rem]" />
                <Skeleton className="h-4 w-full rounded-full" />
                <Skeleton className="h-4 w-3/4 rounded-full" />
              </div>
              <div className="space-y-4">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="space-y-2">
                    <Skeleton className="h-3 w-24 rounded-full" />
                    <Skeleton className="h-13 w-full rounded-[1rem]" />
                  </div>
                ))}
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            </div>
          </SkeletonCard>
        </section>
      </div>
    </main>
  )
}

export function GenericAppSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeaderSkeleton hasActions />
      <TileGridSkeleton count={4} module="neutral" />
      <SkeletonCard tone="lowest" className="h-28" />
    </div>
  )
}

export function ModuleHomeSkeleton({ module = "neutral" }: { module?: ModuleTone }) {
  return (
    <div className="flex flex-col gap-5">
      <ContextNavSkeleton />
      <PageHeaderSkeleton module={module} />
      <TileGridSkeleton count={4} module={module} />
      <SkeletonCard tone="lowest" className="h-28" />
    </div>
  )
}

export function ListPageSkeleton({ module = "neutral" }: { module?: ModuleTone }) {
  return (
    <div className="flex flex-col gap-5">
      <PageHeaderSkeleton module={module} hasActions />
      <StatsAndTableSkeleton />
    </div>
  )
}

export function FormPageSkeleton({ module = "neutral" }: { module?: ModuleTone }) {
  return (
    <div className="flex flex-col gap-5">
      <PageHeaderSkeleton module={module} />
      <SkeletonCard tone="low" className="rounded-[1.75rem] p-4 sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-4 rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-5 shadow-[var(--shadow-airy)]">
            <Skeleton className="h-4 w-28 rounded-full" />
            <Skeleton className="h-8 w-3/4 rounded-[1rem]" />
            <Skeleton className="h-4 w-full rounded-full" />
            <Skeleton className="h-4 w-5/6 rounded-full" />
          </div>
          <div className="space-y-5">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="space-y-2">
                <Skeleton className="h-3 w-24 rounded-full" />
                <Skeleton tone="variant" className="h-13 w-full rounded-[1rem]" />
              </div>
            ))}
            <Skeleton className="h-12 w-full rounded-xl sm:w-52" />
          </div>
        </div>
      </SkeletonCard>
    </div>
  )
}

export function DetailPageSkeleton({ module = "neutral" }: { module?: ModuleTone }) {
  return (
    <div className="flex flex-col gap-5">
      <ContextNavSkeleton />
      <PageHeaderSkeleton module={module} />
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <SkeletonCard tone="low" className="h-44 rounded-[1.75rem]" />
        <SkeletonCard className="h-44 rounded-[1.75rem]" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <SkeletonCard key={item} className="h-32" />
        ))}
      </div>
    </div>
  )
}

export function ActiveSessionSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeaderSkeleton module="entrenamientos" />
      <SkeletonCard tone="low" className="rounded-[1.75rem] p-5 sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-4">
            <Skeleton className="h-4 w-32 rounded-full" />
            <Skeleton className="h-16 w-44 rounded-[1.25rem]" />
            <Skeleton className="h-4 w-full rounded-full" />
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((item) => (
                <SkeletonCard key={item} className="h-24" />
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((item) => (
              <SkeletonCard key={item} className="h-20" />
            ))}
          </div>
        </div>
      </SkeletonCard>
    </div>
  )
}

export function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <ContextNavSkeleton />
      <PageHeaderSkeleton hasActions />
      <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <SkeletonCard className="h-56 rounded-[1.75rem]" />
        <SkeletonCard tone="low" className="h-72 rounded-[1.75rem]" />
      </div>
    </div>
  )
}

export function StatsAndTableSkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.1fr_0.9fr_0.9fr]">
        <SkeletonCard tone="low" className="hidden h-36 sm:col-span-2 sm:block lg:col-span-1" />
        <SkeletonCard className="h-32" />
        <SkeletonCard className="h-32" />
      </div>
      <SkeletonCard tone="low" className="rounded-[1.75rem] p-4 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32 rounded-full" />
            <Skeleton className="h-8 w-56 rounded-[1rem]" />
          </div>
          <Skeleton className="h-4 w-full max-w-sm rounded-full" />
        </div>
        <div className="mt-6 hidden overflow-hidden rounded-[1.5rem] lg:block">
          <Skeleton className="h-14 w-full rounded-none" />
          {[1, 2, 3, 4, 5].map((item) => (
            <Skeleton key={item} tone={item % 2 === 0 ? "low" : "lowest"} className="h-16 w-full rounded-none" />
          ))}
        </div>
        <div className="mt-6 grid gap-4 lg:hidden">
          {[1, 2, 3].map((item) => (
            <SkeletonCard key={item} className="h-44" />
          ))}
        </div>
      </SkeletonCard>
    </div>
  )
}

export function TileGridSkeleton({
  count = 4,
  module = "neutral",
}: {
  count?: number
  module?: ModuleTone
}) {
  const moduleColor =
    module === "finanzas"
      ? "var(--module-finanzas)"
      : module === "entrenamientos"
        ? "var(--module-entrenamientos)"
        : module === "nutricion"
          ? "var(--module-nutricion)"
          : module === "compras"
            ? "var(--module-compras)"
            : "var(--primary)"

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: count }, (_, index) => (
        <SkeletonCard key={index} className="min-h-44">
          <div className="flex items-center justify-between">
            <div
              className="size-10 rounded-full"
              style={{ background: `color-mix(in oklch, ${moduleColor} 14%, transparent)` }}
            />
            <Skeleton className="h-3 w-20 rounded-full" />
          </div>
          <div className="mt-5 space-y-2">
            <Skeleton className="h-5 w-2/3 rounded-full" />
            <Skeleton className="h-4 w-full rounded-full" />
            <Skeleton className="h-4 w-4/5 rounded-full" />
          </div>
          <Skeleton className="mt-6 h-4 w-20 rounded-full" />
        </SkeletonCard>
      ))}
    </div>
  )
}
