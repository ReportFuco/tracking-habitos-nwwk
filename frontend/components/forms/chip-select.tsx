"use client"

import { KeyboardEvent, useRef, useState } from "react"
import { ChevronDown } from "lucide-react"
import { OptionPicker } from "@/components/forms/option-picker"
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
  /**
   * Con mas opciones que esto se muestran solo las primeras (vienen ordenadas por uso) y un
   * chip "Mas" abre todas en una hoja con buscador.
   */
  maxVisible?: number
  searchPlaceholder?: string
}

/**
 * Seleccion de una opcion con chips (fila desplazable en movil): un toque en lugar de abrir
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
  maxVisible,
  searchPlaceholder = "Buscar...",
}: ChipSelectProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const moreRef = useRef<HTMLButtonElement>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const collapsed = maxVisible !== undefined && options.length > maxVisible
  const allSelectedIndex = options.findIndex((option) => option.value === value)
  // Lo elegido en "Mas" se suma como chip, para que se vea que quedo seleccionado.
  const visible =
    collapsed && maxVisible !== undefined
      ? allSelectedIndex >= maxVisible
        ? [...options.slice(0, maxVisible), options[allSelectedIndex]]
        : options.slice(0, maxVisible)
      : options
  const hiddenCount = options.length - visible.length
  const selectedIndex = visible.findIndex((option) => option.value === value)

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0
    if (!delta) return
    event.preventDefault()
    const next = (index + delta + visible.length) % visible.length
    onChange(visible[next].value)
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
        collapsed
          ? // Recortada a unas pocas opciones se envuelve siempre: en una fila desplazable el
            // chip "Mas" quedaria fuera de la pantalla, al final.
            "flex flex-wrap gap-2"
          : // En movil una fila desplazable que sangra hasta el borde; desde sm los chips se
            // envuelven, porque con mouse no hay gesto natural para desplazar en horizontal.
            "-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {visible.map((option, index) => {
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

      {collapsed ? (
        <>
          <button
            ref={moreRef}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={pickerOpen}
            onClick={() => setPickerOpen((prev) => !prev)}
            className="flex min-h-10 shrink-0 items-center gap-1 rounded-md border border-dashed border-border bg-[color:var(--surface-lowest)] px-3 text-sm font-semibold whitespace-nowrap text-foreground transition-colors hover:border-foreground/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Mas
            <span className="text-xs font-normal text-muted-foreground">+{hiddenCount}</span>
            <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
          </button>
          <OptionPicker
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            anchorRef={moreRef}
            options={options.map((option) => ({
              value: option.value,
              label: option.label,
              description: option.hint,
            }))}
            value={value}
            onSelect={onChange}
            title={label}
            searchPlaceholder={searchPlaceholder}
            minPopoverWidth={260}
            capitalize
          />
        </>
      ) : null}
    </div>
  )
}
