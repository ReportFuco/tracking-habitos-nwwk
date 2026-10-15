"use client"

import { useState } from "react"
import { RefreshCw, TriangleAlert } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { quitarFallido, useFallidos, type TipoFallido } from "@/lib/sync-fallidos"

type Resultado = { ok: true; queued?: boolean } | { ok: false; message: string }

/**
 * Lo que la cola offline no logro sincronizar, con la opcion de reintentar o descartar.
 *
 * Antes de que existiera, un alta que fallaba al reconectar desaparecia sin aviso. Aca se
 * ve, y reintentar reusa su client_request_id: si en realidad el backend si la habia
 * guardado, devuelve la misma fila en vez de duplicarla.
 */
export function BandejaNoSincronizados<TPayload>({
  tipo,
  titulo,
  onReintentar,
}: {
  tipo: TipoFallido
  titulo: (cantidad: number) => string
  onReintentar: (payload: TPayload) => Promise<Resultado>
}) {
  const queryClient = useQueryClient()
  const fallidos = useFallidos<TPayload>(tipo)
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [enviando, setEnviando] = useState<string | null>(null)

  if (fallidos.length === 0) {
    return null
  }

  const reintentar = async (id: string, payload: TPayload) => {
    setEnviando(id)
    // Sale de la bandeja mientras viaja; si vuelve a fallar, la cola la devuelve aca.
    quitarFallido(queryClient, id)
    const resultado = await onReintentar(payload)
    setEnviando(null)

    if (!resultado.ok) {
      toast.error("Sigue sin sincronizar", { description: resultado.message })
    } else if (resultado.queued) {
      toast("Quedo en cola", { description: "Se enviara cuando vuelva la conexion." })
    }
  }

  return (
    <section
      aria-label={titulo(fallidos.length)}
      className="space-y-3 rounded-xl bg-destructive/10 p-4 text-sm text-destructive sm:rounded-2xl sm:p-5"
    >
      <p className="flex items-center gap-2 font-medium">
        <TriangleAlert className="size-4 shrink-0" aria-hidden />
        {titulo(fallidos.length)}
      </p>

      <ul className="space-y-2">
        {fallidos.map((fallido) => (
          <li
            key={fallido.id}
            className="flex flex-col gap-3 rounded-lg bg-surface-lowest p-3 text-foreground sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium break-words">{fallido.descripcion}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{fallido.error}</p>
            </div>

            <div className="flex shrink-0 gap-2">
              {confirmando === fallido.id ? (
                <>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="min-h-11"
                    onClick={() => {
                      quitarFallido(queryClient, fallido.id)
                      setConfirmando(null)
                    }}
                  >
                    Descartar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="min-h-11"
                    onClick={() => setConfirmando(null)}
                  >
                    Cancelar
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    className="min-h-11"
                    disabled={enviando !== null}
                    onClick={() => void reintentar(fallido.id, fallido.payload)}
                  >
                    <RefreshCw className="size-3.5" aria-hidden />
                    Reintentar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="min-h-11"
                    disabled={enviando !== null}
                    onClick={() => setConfirmando(fallido.id)}
                  >
                    Descartar
                  </Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
