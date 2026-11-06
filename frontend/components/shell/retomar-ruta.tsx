"use client"

import { usePathname, useRouter } from "next/navigation"
import { type ReactNode, useEffect, useState } from "react"
import { FullScreenLoader } from "@/components/feedback/loaders/full-screen-loader"
import { marcarAppAbierta, recordarRuta, rutaParaRetomar } from "@/lib/ultima-ruta"

/** Lo minimo que se ve el loader al retomar: menos que esto se lee como un parpadeo. */
const LOADER_MINIMO_MS = 800

/**
 * Lleva al usuario a la pantalla donde quedo cuando vuelve a abrir la app, y va guardando
 * cada pantalla que visita. Va dentro del AuthGuard: necesita saber quien es el usuario
 * para no retomar la pantalla de otro.
 *
 * Mientras se viaja a la pantalla retomada se muestra el loader (el mismo del guard, asi
 * se ve como una sola carga) en vez de la de entrada: si no, el dashboard asomaba un
 * instante antes del salto. Se quita cuando ya se dejo la entrada y paso el minimo.
 */
export function RetomarRuta({ usuario, children }: { usuario: number; children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  // Se decide una sola vez, al montar. La funcion no tiene efectos, asi que el doble
  // render de StrictMode no la descuadra.
  const [entrada] = useState(() => (typeof window === "undefined" ? "" : window.location.pathname))
  const [destino] = useState(() => (entrada ? rutaParaRetomar(entrada, usuario) : null))
  const [minimoCumplido, setMinimoCumplido] = useState(false)

  useEffect(() => {
    marcarAppAbierta()

    if (!destino) return

    router.replace(destino)
    const timer = window.setTimeout(() => setMinimoCumplido(true), LOADER_MINIMO_MS)
    return () => window.clearTimeout(timer)
  }, [destino, router])

  // Se compara contra la entrada y no contra el destino: si la pantalla retomada redirige
  // a otra (el entreno activo cuando ya no hay sesion abierta) el loader igual se quita.
  // Queda marcado una vez que se salio: volver despues al inicio a mano es navegar normal.
  const [salioDeEntrada, setSalioDeEntrada] = useState(false)
  if (destino !== null && !salioDeEntrada && pathname !== entrada) {
    setSalioDeEntrada(true)
  }
  const retomando = destino !== null && (!salioDeEntrada || !minimoCumplido)

  useEffect(() => {
    // La pantalla de entrada que se esta dejando atras no se guarda: pisaria el destino.
    if (!pathname || (destino !== null && !salioDeEntrada)) return
    recordarRuta(pathname, usuario)
  }, [destino, salioDeEntrada, pathname, usuario])

  if (retomando) {
    return <FullScreenLoader accent="olive" label="Volviendo a donde quedaste..." mode="session" />
  }

  // Tras el loader la pantalla retomada entra con un fundido en vez de aparecer de golpe.
  // `destino` no cambia en la vida del componente, asi que el envoltorio no se monta y
  // desmonta a mitad de camino; sin retomar no se agrega nada.
  if (destino !== null) {
    return <div className="motion-safe:animate-[ritmo-fade_360ms_ease-out]">{children}</div>
  }

  return <>{children}</>
}
