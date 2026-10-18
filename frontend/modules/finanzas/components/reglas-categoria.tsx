"use client"

import { FormEvent, useState } from "react"
import { Plus, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { getFriendlyErrorMessage } from "@/lib/error-messages"
import { useFinanzas, useReglasCategoria } from "@/modules/finanzas/hooks/useFinanzas"
import type { ReglaCategoria } from "@/modules/finanzas/types/finanzas"

const inputClass =
  "h-11 w-full min-w-0 rounded-md border border-border bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground"
const tituloClass = "text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"

/**
 * Reglas por comercio: si la descripcion de un gasto contiene el texto, va a esa
 * categoria. Las usa el registro sin categoria o como «Otros» (el Atajo de Wallet) y la
 * carga de cartolas.
 */
export function ReglasCategoria() {
  const { categorias } = useFinanzas()
  const reglasQuery = useReglasCategoria()
  const [patron, setPatron] = useState("")
  const [idCategoria, setIdCategoria] = useState("")

  const reglas = reglasQuery.data ?? []
  const porCategoria = reglas.reduce<Record<string, ReglaCategoria[]>>((grupos, regla) => {
    ;(grupos[regla.categoria] ??= []).push(regla)
    return grupos
  }, {})

  const agregar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (patron.trim().length < 3 || !idCategoria) return
    try {
      await reglasQuery.guardar.mutateAsync([{ patron: patron.trim(), id_categoria: Number(idCategoria) }])
      toast.success(`Lo que diga «${patron.trim()}» se anotara solo`)
      setPatron("")
    } catch (error) {
      toast.error("No pudimos guardar la regla", { description: getFriendlyErrorMessage(error) })
    }
  }

  const eliminar = async (regla: ReglaCategoria) => {
    try {
      await reglasQuery.eliminar.mutateAsync(regla.id_regla)
    } catch (error) {
      toast.error("No pudimos quitar la regla", { description: getFriendlyErrorMessage(error) })
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:p-5">
      <h2 className={tituloClass}>Categoria automatica por comercio</h2>
      <p className="text-sm text-muted-foreground">
        Si un gasto llega sin categoria o como «Otros» (por ejemplo desde el Atajo de Wallet) y su descripcion contiene el
        texto, se anota en esa categoria.
      </p>
      <form onSubmit={agregar} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="regla-patron" className="sr-only">
          Texto del comercio
        </label>
        <input
          id="regla-patron"
          maxLength={80}
          placeholder="Ej: TOTTUS, UBER EATS, BIPQR"
          value={patron}
          onChange={(event) => setPatron(event.target.value)}
          className={inputClass}
        />
        <label htmlFor="regla-categoria" className="sr-only">
          Categoria
        </label>
        <select
          id="regla-categoria"
          value={idCategoria}
          onChange={(event) => setIdCategoria(event.target.value)}
          className={`${inputClass} sm:max-w-48`}
        >
          <option value="">Categoria...</option>
          {categorias.map((categoria) => (
            <option key={categoria.id_categoria} value={categoria.id_categoria}>
              {categoria.nombre}
            </option>
          ))}
        </select>
        <Button
          type="submit"
          className="h-11 shrink-0"
          disabled={reglasQuery.guardar.isPending || patron.trim().length < 3 || !idCategoria}
        >
          <Plus className="size-4" aria-hidden />
          Agregar
        </Button>
      </form>

      {reglasQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : reglas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aun no hay reglas.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {Object.entries(porCategoria).map(([categoria, grupo]) => (
            <li key={categoria} className="flex flex-col gap-1.5 py-2.5">
              <span className="text-sm font-semibold">{categoria}</span>
              <ul className="flex flex-wrap gap-1.5">
                {grupo.map((regla) => (
                  <li key={regla.id_regla} className="flex items-center gap-1 rounded-md border border-border py-0.5 pl-2 pr-0.5 text-sm">
                    <span className="font-mono text-xs">{regla.patron}</span>
                    <button
                      type="button"
                      onClick={() => void eliminar(regla)}
                      aria-label={`Quitar la regla ${regla.patron}`}
                      className="inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-[color:var(--surface-low)] hover:text-foreground"
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
