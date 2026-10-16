import { FinanzasHeader } from "@/modules/finanzas/components/finanzas-header"
import { MisCategorias } from "@/modules/finanzas/components/mis-categorias"

export default function CategoriasPage() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <FinanzasHeader title="Categorias" />
      <MisCategorias />
    </div>
  )
}
