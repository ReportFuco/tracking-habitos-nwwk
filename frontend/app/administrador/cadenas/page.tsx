import { PageHeader } from "@/components/shell/page-header"
import { ContextNav } from "@/components/shell/context-nav"
import { CadenasManager } from "@/modules/compras/components/cadenas-manager"

export default function CadenasPage() {
  return (
    <div className="flex flex-col gap-6">
      <ContextNav
        crumbs={[
          { label: "Administracion", href: "/administrador" },
          { label: "Cadenas" },
        ]}
      />
      <PageHeader
        eyebrow="Compras maestras"
        title="Cadenas"
        description="Catalogo de cadenas de tiendas para asociar a locales."
      />
      <CadenasManager />
    </div>
  )
}
