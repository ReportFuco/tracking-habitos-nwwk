import { ConexionesIA } from "@/modules/usuario/components/conexiones-ia"
import { PerfilHeader } from "@/modules/usuario/components/perfil-header"

export default function PerfilConexionesPage() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <PerfilHeader title="Conexiones con IA" />
      <ConexionesIA />
    </div>
  )
}
