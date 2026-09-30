import { PageHeader } from "@/components/shell/page-header"
import { ContextNav } from "@/components/shell/context-nav"
import { ProductosManager } from "@/modules/catalogo/components/productos-manager"

export default function ProductosPage() {
  return (
    <div className="flex flex-col gap-6">
      <ContextNav
        crumbs={[
          { label: "Administracion", href: "/administrador" },
          { label: "Productos" },
        ]}
      />
      <PageHeader
        eyebrow="Catalogo maestro"
        title="Productos"
        description="Revisa lo que proponen los usuarios y cuida el catalogo compartido."
      />
      <ProductosManager />
    </div>
  )
}
