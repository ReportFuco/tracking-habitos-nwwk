import { Suspense } from "react"
import { AutorizarConexion } from "@/modules/usuario/components/autorizar-conexion"

// Destino de /authorize del servidor OAuth del MCP (backend app/mcp/oauth.py).
export default function AutorizarConexionPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-[color:var(--surface-low)]" aria-hidden />}>
      <AutorizarConexion />
    </Suspense>
  )
}
