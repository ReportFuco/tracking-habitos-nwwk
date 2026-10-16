import { PerfilDatos } from "@/modules/usuario/components/perfil-datos"
import { PerfilHeader } from "@/modules/usuario/components/perfil-header"

export default function PerfilDatosPage() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <PerfilHeader title="Datos personales" description="Solo se guardan los campos que cambies." />
      <PerfilDatos />
    </div>
  )
}
