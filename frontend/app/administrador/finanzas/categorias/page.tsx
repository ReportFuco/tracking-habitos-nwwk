import { CategoriasManager } from "@/modules/finanzas/components/categorias-manager"
import { FinanzasProvider } from "@/modules/finanzas/hooks/useFinanzas"
import { PageHeader } from "@/components/shell/page-header"
import { ContextNav } from "@/components/shell/context-nav"

export default function CategoriasPage() {
  return (
    <div className="flex flex-col gap-6">
      <ContextNav
        crumbs={[
          { label: "Administracion", href: "/administrador" },
          { label: "Categorias" },
        ]}
      />
      <PageHeader
        eyebrow="Finanzas maestras"
        title="Categorias"
        description="Crea, edita y elimina las categorias de movimientos."
      />

      <FinanzasProvider>
        <CategoriasManager />
      </FinanzasProvider>
    </div>
  )
}
