"use client"

import { useState } from "react"
import Image from "next/image"
import { ExternalLink, Pencil, Play, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { EjercicioMedia } from "@/modules/entrenamientos/components/ejercicio-media"
import { describirGrupo } from "@/modules/entrenamientos/components/ejercicio-card"
import type { EjercicioResponse } from "@/modules/entrenamientos/types/entrenamientos"

const usaMenosMovimiento = () => {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

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
  // Con "reducir movimiento" activo la animacion no arranca sola: el usuario decide si
  // quiere verla. Un WebP animado no se puede pausar por CSS, asi que hay que elegir la
  // fuente antes de montar la imagen.
  const [animando, setAnimando] = useState(() => !usaMenosMovimiento())
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false)

  const mostrandoAnimacion = animando && Boolean(ejercicio.url_animacion)
  const fuente = mostrandoAnimacion ? ejercicio.url_animacion : ejercicio.url_imagen

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
          <div className="flex items-start gap-4">
            <div className="relative">
              {fuente ? (
                <div className="relative size-24 shrink-0 overflow-hidden rounded-[1.25rem] bg-surface-low sm:size-28">
                  <Image
                    src={fuente}
                    alt={ejercicio.nombre}
                    width={180}
                    height={180}
                    unoptimized
                    priority
                    className="size-full object-cover"
                  />
                </div>
              ) : (
                <EjercicioMedia src={null} alt="" size={96} className="rounded-[1.25rem]" />
              )}

              {!mostrandoAnimacion && ejercicio.url_animacion ? (
                <button
                  type="button"
                  onClick={() => setAnimando(true)}
                  aria-label="Ver la animacion del ejercicio"
                  className="absolute inset-0 flex items-center justify-center rounded-[1.25rem] bg-foreground/35 text-background transition hover:bg-foreground/45"
                >
                  <Play className="size-7" aria-hidden />
                </button>
              ) : null}
            </div>

            <div className="min-w-0 flex-1 space-y-2 pt-1">
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
