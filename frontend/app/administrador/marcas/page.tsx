import { PageHeader } from "@/components/shell/page-header"
import { ContextNav } from "@/components/shell/context-nav"
import { MarcasManager } from "@/modules/catalogo/components/marcas-manager"

export default function MarcasPage() {
  return (
    <div className="flex flex-col gap-6">
      <ContextNav
        crumbs={[
          { label: "Administracion", href: "/administrador" },
          { label: "Marcas" },
        ]}
      />
      <PageHeader
        eyebrow="Catalogo"
        title="Marcas"
        description="Catalogo maestro de marcas de productos."
      />
      <MarcasManager />
    </div>
  )
}
