"use client"

import { useState } from "react"
import { ExternalLink, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { EjercicioAnimacion } from "@/modules/entrenamientos/components/ejercicio-media"
import { describirGrupo } from "@/modules/entrenamientos/components/ejercicio-card"
import type { EjercicioResponse } from "@/modules/entrenamientos/types/entrenamientos"

function Etiqueta({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-surface-low px-3 py-1 text-xs text-muted-foreground">
      {children}
    </span>
  )
}

/**
 * Ficha de un ejercicio.
 *
 * En el telefono entra como hoja desde abajo, que es donde llega el pulgar; en pantallas
 * grandes vuelve a ser un dialogo centrado.
 */
/** El componente se monta por ejercicio (`key`), asi que su estado nace limpio en cada ficha. */
export function EjercicioDetalleDialog({
  ejercicio,
  onClose,
  onEditar,
  onEliminar,
  eliminando,
}: {
  ejercicio: EjercicioResponse
  onClose: () => void
  onEditar: (ejercicio: EjercicioResponse) => void
  onEliminar: (ejercicio: EjercicioResponse) => void
  eliminando: boolean
}) {
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false)

  return (
    <Dialog open onOpenChange={(abierto) => (abierto ? null : onClose())}>
      <DialogContent
        showCloseButton={false}
        className="top-auto bottom-0 left-0 max-h-[92dvh] max-w-full translate-x-0 translate-y-0 overflow-y-auto rounded-t-[1.75rem] rounded-b-none border-0 bg-surface-lowest p-0 shadow-(--shadow-airy-lg) sm:top-[50%] sm:left-[50%] sm:max-w-lg sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-[1.75rem]"
      >
        {/* Asidero visual de la hoja: indica que se puede cerrar arrastrando o tocando fuera. */}
        <div
          aria-hidden
          className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-border sm:hidden"
        />

        <div className="space-y-5 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:px-7 sm:pt-6 sm:pb-7">
          {/* En el telefono la demostracion va arriba y a 180px -- el tamano nativo del
              material -- porque es lo que se viene a ver. En pantallas anchas se acomoda
              al lado del titulo, donde ya hay sitio para ambos. */}
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <EjercicioAnimacion
              imagen={ejercicio.url_imagen}
              animacion={ejercicio.url_animacion}
              alt={ejercicio.nombre}
              className="size-[11.25rem] sm:size-28"
              priority
            />

            <div className="min-w-0 w-full flex-1 space-y-2 text-center sm:pt-1 sm:text-left">
              <DialogTitle className="text-lg leading-tight font-semibold tracking-[-0.01em] text-foreground sm:text-xl">
                {ejercicio.nombre}
              </DialogTitle>
              {ejercicio.nombre_original ? (
                <DialogDescription className="text-xs text-muted-foreground">
                  {ejercicio.nombre_original}
                </DialogDescription>
              ) : (
                <DialogDescription className="sr-only">
                  Ficha del ejercicio {ejercicio.nombre}
                </DialogDescription>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span
              className="rounded-full px-3 py-1 text-xs font-medium text-tertiary-foreground"
              style={{ background: "var(--module-entrenamientos)" }}
            >
              {describirGrupo(ejercicio)}
            </span>
            {ejercicio.equipamiento ? <Etiqueta>{ejercicio.equipamiento}</Etiqueta> : null}
            {ejercicio.musculos_secundarios?.map((musculo) => (
              <Etiqueta key={musculo}>{musculo}</Etiqueta>
            ))}
          </div>

          {ejercicio.instrucciones?.length ? (
            <section className="space-y-3 rounded-[1.5rem] bg-surface-low p-4">
              <h3 className="font-label text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
                Ejecucion
              </h3>
              <ol className="space-y-2.5">
                {ejercicio.instrucciones.map((paso, indice) => (
                  <li key={paso} className="flex gap-3 text-sm leading-6 text-foreground">
                    <span
                      aria-hidden
                      className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-lowest text-[0.7rem] font-medium text-muted-foreground"
                    >
                      {indice + 1}
                    </span>
                    {paso}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {ejercicio.url_video ? (
            <a
              href={ejercicio.url_video}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              <ExternalLink className="size-4" aria-hidden />
              Ver video
            </a>
          ) : null}

          <div className="flex flex-wrap gap-2 border-t border-border/50 pt-4">
            <Button
              variant="outline"
              className="min-h-11 flex-1 sm:flex-none"
              onClick={() => onEditar(ejercicio)}
            >
              <Pencil className="size-4" aria-hidden />
              Editar
            </Button>
            {confirmandoBorrado ? (
              <>
                <Button
                  variant="destructive"
                  className="min-h-11 flex-1 sm:flex-none"
                  disabled={eliminando}
                  onClick={() => onEliminar(ejercicio)}
                >
                  {eliminando ? "Eliminando..." : "Confirmar"}
                </Button>
                <Button
                  variant="ghost"
                  className="min-h-11"
                  onClick={() => setConfirmandoBorrado(false)}
                >
                  Cancelar
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                className="min-h-11 text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmandoBorrado(true)}
              >
                <Trash2 className="size-4" aria-hidden />
                Eliminar
              </Button>
            )}
          </div>

          {/* La licencia del material exige mostrar esta atribucion donde se use. */}
          {ejercicio.atribucion ? (
            <p className="text-[0.7rem] leading-5 text-muted-foreground/70">
              {ejercicio.atribucion}
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
