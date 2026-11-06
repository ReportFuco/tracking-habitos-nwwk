"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef } from "react"
import { recordarRuta, rutaParaRetomar } from "@/lib/ultima-ruta"

/**
 * Lleva al usuario a la pantalla donde quedo cuando vuelve a abrir la app, y va guardando
 * cada pantalla que visita. Va dentro del AuthGuard: necesita saber quien es el usuario
 * para no retomar la pantalla de otro.
 */
export function RetomarRuta({ usuario }: { usuario: number }) {
  const pathname = usePathname()
  const router = useRouter()
  const revisado = useRef(false)

  useEffect(() => {
    if (!pathname) return

    // La primera vez se decide si retomar, antes de guardar nada: guardar primero pisaria
    // la pantalla anterior con la de entrada.
    if (!revisado.current) {
      revisado.current = true
      const destino = rutaParaRetomar(pathname, usuario)

      if (destino) {
        router.replace(destino)
        return
      }
    }

    recordarRuta(pathname, usuario)
  }, [pathname, router, usuario])

  return null
}
