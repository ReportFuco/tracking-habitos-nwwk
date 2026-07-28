import { PageHeader } from "@/components/shell/page-header"
import { ContextNav } from "@/components/shell/context-nav"
import { UsuariosAdminManager } from "@/modules/usuario/components/usuarios-admin-manager"

export default function UsuariosPage() {
  return (
    <div className="flex flex-col gap-6">
      <ContextNav
        crumbs={[
          { label: "Administracion", href: "/administrador" },
          { label: "Usuarios" },
        ]}
      />
      <PageHeader
        eyebrow="Sistema"
        title="Usuarios"
        description="Listado de usuarios registrados. Desactivar o eliminar cuentas."
      />
      <UsuariosAdminManager />
    </div>
  )
}
