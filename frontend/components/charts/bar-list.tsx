import { cn } from "@/lib/utils"

export interface BarListItem {
  id: string | number
  label: string
  value: number
  /** Porcentaje del total ya calculado por el backend. */
  share?: number
}

interface BarListProps {
  items: BarListItem[]
  formatValue: (value: number) => string
  color: string
  label: string
  /** Cuantas filas mostrar antes de agrupar el resto en "Otras". */
  limit?: number
  className?: string
}

const shareFormatter = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 })

/**
 * Ranking horizontal de una sola serie (p. ej. gasto por categoria). Cada fila lleva su
 * valor escrito, asi que no depende de hover ni de color para leerse.
 */
export function BarList({ items, formatValue, color, label, limit = 6, className }: BarListProps) {
  const sorted = [...items].sort((a, b) => b.value - a.value)
  const visible = sorted.slice(0, limit)
  const rest = sorted.slice(limit)
  if (rest.length > 0) {
    visible.push({
      id: "otras",
      label: `Otras (${rest.length})`,
      value: rest.reduce((sum, item) => sum + item.value, 0),
      share: rest.reduce((sum, item) => sum + (item.share ?? 0), 0),
    })
  }
  const max = Math.max(1, ...visible.map((item) => item.value))

  return (
    <ul className={cn("flex flex-col gap-3", className)} aria-label={label}>
      {visible.map((item) => (
        <li key={item.id} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium capitalize text-foreground">{item.label}</span>
            <span className="shrink-0 tabular-nums text-foreground">
              {formatValue(item.value)}
              {item.share !== undefined ? (
                <span className="ml-2 text-xs text-muted-foreground">
                  {shareFormatter.format(item.share)}%
                </span>
              ) : null}
            </span>
          </div>
          <div className="h-2 w-full bg-[color:var(--surface-low)]" aria-hidden>
            <div
              className="h-full rounded-r-[3px]"
              style={{ width: `${(item.value / max) * 100}%`, background: color }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
