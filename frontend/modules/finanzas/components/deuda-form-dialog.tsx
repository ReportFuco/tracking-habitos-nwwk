"use client"

import { FormEvent, useState } from "react"
import { ArrowDownLeft, ArrowUpRight } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatCLP } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useDeudasMutations } from "@/modules/finanzas/hooks/useFinanzas"
import type { DeudaPatch, DeudaResponse, TipoDeuda } from "@/modules/finanzas/types/finanzas"

const milesFormatter = new Intl.NumberFormat("es-CL")
const inputClass =
  "h-11 w-full min-w-0 rounded-md border border-border bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground"
const etiquetaClass = "text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"

/** Color de cada tipo: lo que debo se paga con gastos; lo que me deben vuelve como ingreso. */
export const TIPO_DEUDA_UI: Record<TipoDeuda, { label: string; color: string; on: string; abonar: string }> = {
  debo: { label: "Debo", color: "var(--gasto)", on: "var(--gasto-on)", abonar: "Pagar" },
  me_deben: { label: "Me deben", color: "var(--ingreso)", on: "var(--ingreso-on)", abonar: "Cobrar" },
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Sin deuda crea una nueva; con deuda la edita (el tipo no se cambia). */
  deuda?: DeudaResponse
  onCreada?: (deuda: DeudaResponse) => void
}

export function DeudaFormDialog({ open, onOpenChange, deuda, onCreada }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Se monta al abrir: cada apertura parte con los datos actuales. */}
        {open ? <DeudaForm deuda={deuda} onDone={() => onOpenChange(false)} onCreada={onCreada} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function DeudaForm({
  deuda,
  onDone,
  onCreada,
}: {
  deuda?: DeudaResponse
  onDone: () => void
  onCreada?: (deuda: DeudaResponse) => void
}) {
  const { crearDeuda, editarDeuda, guardandoDeuda } = useDeudasMutations()
  const [tipo, setTipo] = useState<TipoDeuda>(deuda?.tipo ?? "debo")
  const [nombre, setNombre] = useState(deuda?.nombre ?? "")
  const [contraparte, setContraparte] = useState(deuda?.contraparte ?? "")
  const [monto, setMonto] = useState(deuda ? String(deuda.monto_total) : "")
  const [descripcion, setDescripcion] = useState(deuda?.descripcion ?? "")
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const montoTotal = Number(monto || 0)
    if (!nombre.trim()) {
      setError("Ponle un nombre a la deuda")
      return
    }
    if (!montoTotal) {
      setError("Ingresa el monto total")
      return
    }

    if (!deuda) {
      const result = await crearDeuda({
        tipo,
        nombre: nombre.trim(),
        contraparte: contraparte.trim() || null,
        monto_total: montoTotal,
        descripcion: descripcion.trim() || null,
      })
      if (!result.ok) {
        setError(result.message)
        return
      }
      toast.success(`Deuda «${result.deuda.nombre}» registrada`)
      onCreada?.(result.deuda)
      onDone()
      return
    }

    const cambios: DeudaPatch = {}
    if (nombre.trim() !== deuda.nombre) cambios.nombre = nombre.trim()
    if (contraparte.trim() !== (deuda.contraparte ?? "")) cambios.contraparte = contraparte.trim() || null
    if (montoTotal !== deuda.monto_total) cambios.monto_total = montoTotal
    if (descripcion.trim() !== (deuda.descripcion ?? "")) cambios.descripcion = descripcion.trim() || null
    if (Object.keys(cambios).length === 0) {
      onDone()
      return
    }
    const result = await editarDeuda(deuda.id_deuda, cambios)
    if (!result.ok) {
      setError(result.message)
      return
    }
    toast.success("Deuda actualizada")
    onDone()
  }

  const ui = TIPO_DEUDA_UI[tipo]

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{deuda ? "Editar deuda" : "Nueva deuda"}</DialogTitle>
        <DialogDescription>
          {tipo === "debo"
            ? "Se va pagando con gastos: cada gasto que la abone descuenta del saldo."
            : "Se va cobrando con ingresos: cada ingreso que la abone descuenta del saldo."}
        </DialogDescription>
      </DialogHeader>

      {deuda ? null : (
        <div role="radiogroup" aria-label="Tipo de deuda" className="grid grid-cols-2 gap-1 rounded-lg bg-[color:var(--surface-low)] p-1">
          {(["debo", "me_deben"] as TipoDeuda[]).map((valor) => {
            const activo = tipo === valor
            const Icon = valor === "debo" ? ArrowUpRight : ArrowDownLeft
            return (
              <button
                key={valor}
                type="button"
                role="radio"
                aria-checked={activo}
                onClick={() => setTipo(valor)}
                className={cn(
                  "flex h-10 items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  !activo && "text-muted-foreground hover:text-foreground",
                )}
                style={activo ? { background: TIPO_DEUDA_UI[valor].color, color: TIPO_DEUDA_UI[valor].on } : undefined}
              >
                <Icon className="size-4" aria-hidden />
                {TIPO_DEUDA_UI[valor].label}
              </button>
            )
          })}
        </div>
      )}

      <div>
        <label htmlFor="deuda-monto" className={etiquetaClass}>
          Monto total
        </label>
        <div className="mt-1 flex items-baseline gap-2 border-b-2 border-border pb-2 focus-within:border-foreground">
          <span aria-hidden className="font-display text-3xl text-muted-foreground">
            $
          </span>
          <input
            id="deuda-monto"
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            value={monto ? milesFormatter.format(Number(monto)) : ""}
            onChange={(event) => {
              setError(null)
              setMonto(event.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 11))
            }}
            className="w-full min-w-0 bg-transparent font-display text-4xl leading-none tabular-nums outline-none placeholder:text-muted-foreground/40"
            style={{ color: monto ? ui.color : undefined }}
          />
        </div>
        {deuda && deuda.abonado > 0 ? (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Ya abonado: {formatCLP(deuda.abonado)}. El total no puede ser menor.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="deuda-nombre" className={etiquetaClass}>
          Nombre
        </label>
        <input
          id="deuda-nombre"
          maxLength={120}
          placeholder={tipo === "debo" ? "Ej: Crédito de consumo, Notebook en cuotas" : "Ej: Préstamo para el arriendo"}
          value={nombre}
          onChange={(event) => {
            setError(null)
            setNombre(event.target.value)
          }}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="deuda-contraparte" className={etiquetaClass}>
          {tipo === "debo" ? "A quién le debes" : "Quién te debe"}
        </label>
        <input
          id="deuda-contraparte"
          maxLength={120}
          placeholder="Opcional"
          value={contraparte}
          onChange={(event) => setContraparte(event.target.value)}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="deuda-nota" className={etiquetaClass}>
          Nota
        </label>
        <input
          id="deuda-nota"
          maxLength={500}
          placeholder="Opcional"
          value={descripcion}
          onChange={(event) => setDescripcion(event.target.value)}
          className={inputClass}
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={guardandoDeuda}>
          {guardandoDeuda ? "Guardando..." : deuda ? "Guardar cambios" : "Registrar deuda"}
        </Button>
      </DialogFooter>
    </form>
  )
}
