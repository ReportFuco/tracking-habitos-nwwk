"use client"

import { usePerfil } from "@/modules/usuario/hooks/usePerfil"
import { PerfilEditForm } from "./perfil-edit-form"

export function PerfilDatos() {
  const { perfil, loading, submitting, error, actualizarPerfil } = usePerfil()

  if (!perfil) {
    return (
      <p className={error ? "text-sm text-[color:var(--destructive)]" : "text-sm text-muted-foreground"}>
        {error ?? (loading ? "Cargando tus datos..." : "No pudimos cargar tus datos.")}
      </p>
    )
  }

  return <PerfilEditForm perfil={perfil} submitting={submitting} onSubmit={actualizarPerfil} />
}
