"use client"

import { KeyboardEvent, useRef } from "react"
import { cn } from "@/lib/utils"

export interface ChipOption {
  value: string
  label: string
  /** Texto secundario pequeño (p. ej. banco de una cuenta). */
  hint?: string
}

interface ChipSelectProps {
  options: ChipOption[]
  value: string
  onChange: (value: string) => void
  /** Nombre accesible del grupo. */
  label: string
  /** Id del elemento que describe el error, si lo hay. */
  errorId?: string
  invalid?: boolean
  loading?: boolean
  emptyMessage?: string
  className?: string
}

/**
 * Seleccion de una opcion con chips en una fila desplazable: un toque en lugar de abrir
 * un combobox. Es un radiogroup: flechas para moverse, Tab entra y sale del grupo.
 */
export function ChipSelect({
  options,
  value,
  onChange,
  label,
  errorId,
  invalid = false,
  loading = false,
  emptyMessage = "Sin opciones",
  className,
}: ChipSelectProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const selectedIndex = options.findIndex((option) => option.value === value)

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0
    if (!delta) return
    event.preventDefault()
    const next = (index + delta + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }

  if (loading) {
    return (
      <div className={cn("flex gap-2", className)} aria-hidden>
        {[72, 96, 64, 88].map((width) => (
          <span key={width} className="h-10 shrink-0 animate-pulse rounded-md bg-[color:var(--surface-low)]" style={{ width }} />
        ))}
      </div>
    )
  }

  if (options.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-invalid={invalid || undefined}
      aria-describedby={errorId}
      className={cn(
        "-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {options.map((option, index) => {
        const selected = option.value === value
        // Sin seleccion, el primer chip es el que recibe el foco con Tab.
        const tabbable = selected || (selectedIndex === -1 && index === 0)
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={tabbable ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "flex min-h-10 shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              selected
                ? "border-foreground bg-foreground text-background"
                : invalid
                  ? "border-destructive/60 bg-[color:var(--surface-lowest)] text-foreground"
                  : "border-border bg-[color:var(--surface-lowest)] text-foreground hover:border-foreground/40",
            )}
          >
            <span className="capitalize">{option.label}</span>
            {option.hint ? (
              <span className={cn("text-xs font-normal", selected ? "opacity-70" : "text-muted-foreground")}>
                {option.hint}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
