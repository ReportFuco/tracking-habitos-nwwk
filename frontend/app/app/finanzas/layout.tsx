import { MovimientosNoSincronizados } from "@/modules/finanzas/components/movimientos-no-sincronizados"
import { FinanzasProvider } from "@/modules/finanzas/hooks/useFinanzas"

export default function FinanzasLayout({ children }: { children: React.ReactNode }) {
  return (
    <FinanzasProvider>
      <div className="mb-4 empty:hidden sm:mb-6">
        <MovimientosNoSincronizados />
      </div>
      {children}
    </FinanzasProvider>
  )
}
