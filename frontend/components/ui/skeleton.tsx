import { cn } from "@/lib/utils"

type SkeletonTone = "variant" | "low" | "lowest"

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: SkeletonTone
}

const toneClassName: Record<SkeletonTone, string> = {
  variant: "bg-[color:var(--surface-variant)]",
  low: "bg-[color:var(--surface-low)]",
  lowest: "bg-[color:var(--surface-lowest)]",
}

export function Skeleton({ className, tone = "variant", ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-pulse rounded-[1rem] [animation-duration:1.6s]",
        toneClassName[tone],
        className
      )}
      {...props}
    />
  )
}

interface SkeletonCardProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: SkeletonTone
}

export function SkeletonCard({
  className,
  tone = "lowest",
  children,
  ...props
}: SkeletonCardProps) {
  return (
    <div
      className={cn(
        "rounded-[1.5rem] p-4 shadow-[var(--shadow-airy)] sm:p-5",
        toneClassName[tone],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
