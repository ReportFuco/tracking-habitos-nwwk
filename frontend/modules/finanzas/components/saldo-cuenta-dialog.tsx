"use client"

import { FormEvent, useState } from "react"
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
import { useFinanzas } from "@/modules/finanzas/hooks/useFinanzas"
import { esProductoCredito } from "@/modules/finanzas/saldo"
import type { CuentaResponse } from "@/modules/finanzas/types/finanzas"

const milesFormatter = new Intl.NumberFormat("es-CL")

interface Props {
  cuenta: CuentaResponse | null
  onOpenChange: (open: boolean) => void
}

/** Declarar (o ajustar) cuanto hay hoy en una cuenta. Abierto mientras haya cuenta. */
export function SaldoCuentaDialog({ cuenta, onOpenChange }: Props) {
  return (
    <Dialog open={cuenta !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Se monta al abrir: cada apertura parte con el saldo actual de esa cuenta. */}
        {cuenta ? <SaldoForm cuenta={cuenta} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function SaldoForm({ cuenta, onDone }: { cuenta: CuentaResponse; onDone: () => void }) {
  const { declararSaldo, submittingCuenta } = useFinanzas()
  const credito = esProductoCredito(cuenta.nombre_producto)
  const actual = cuenta.saldo_actual
  const [monto, setMonto] = useState(actual == null ? "" : String(Math.abs(actual)))
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (monto === "") {
      setError(credito ? "Ingresa cuánto debes (0 si no debes nada)" : "Ingresa cuánto tienes (puede ser 0)")
      return
    }
    const valor = Number(monto)
    const result = await declararSaldo(cuenta.id_cuenta, credito ? -valor : valor)
    if (!result.ok) {
      setError(result.message)
      return
    }
    toast.success(actual == null ? `Saldo de «${cuenta.nombre_cuenta}» listo` : "Saldo ajustado")
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{actual == null ? "¿Con cuánto partes?" : "Ajustar saldo"}</DialogTitle>
        <DialogDescription>
          {credito
            ? `Lo que debes hoy en ${cuenta.nombre_cuenta}. Cada compra que anotes lo sube y cada pago lo baja.`
            : `Lo que tienes hoy en ${cuenta.nombre_cuenta}, como lo ves en tu banco. Cada gasto que anotes lo baja y cada ingreso lo sube.`}
        </DialogDescription>
      </DialogHeader>

      <div>
        <label htmlFor="saldo-monto" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {credito ? "Debes hoy" : "Tienes hoy"}
        </label>
        <div className="mt-1 flex items-baseline gap-2 border-b-2 border-border pb-2 focus-within:border-foreground">
          <span aria-hidden className="font-display text-3xl text-muted-foreground">
            $
          </span>
          <input
            id="saldo-monto"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            placeholder="0"
            value={monto ? milesFormatter.format(Number(monto)) : ""}
            onChange={(event) => {
              setError(null)
              setMonto(event.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 11))
            }}
            className="w-full min-w-0 bg-transparent font-display text-4xl leading-none tabular-nums outline-none placeholder:text-muted-foreground/40"
            style={{ color: monto ? (credito ? "var(--gasto)" : "var(--ingreso)") : undefined }}
          />
        </div>
        {actual != null ? (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Si no calza con tu banco, pon lo que dice el banco: desde hoy se cuenta desde ahí.
          </p>
        ) : null}
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
        <Button type="submit" disabled={submittingCuenta}>
          {submittingCuenta ? "Guardando..." : "Guardar saldo"}
        </Button>
      </DialogFooter>
    </form>
  )
}
