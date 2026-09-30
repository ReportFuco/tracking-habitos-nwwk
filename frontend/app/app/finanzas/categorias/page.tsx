import { PageHeader } from "@/components/shell/page-header"
import { FinanzasMenuLinks } from "@/modules/finanzas/components/menu-links"
import { MisCategorias } from "@/modules/finanzas/components/mis-categorias"

export default function CategoriasPage() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <PageHeader eyebrow="Finanzas" title="Categorias" className="pb-0" />
      <FinanzasMenuLinks />
      <MisCategorias />
    </div>
  )
}
