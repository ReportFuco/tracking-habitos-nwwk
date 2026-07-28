"use client"

import { ContextNav } from "@/components/shell/context-nav"
import { PageHeader } from "@/components/shell/page-header"
import { usePerfil } from "@/modules/usuario/hooks/usePerfil"
import { PerfilEditForm } from "./perfil-edit-form"
import { PerfilSummaryCard } from "./perfil-summary-card"

export function PerfilView() {
  const { perfil, loading, submitting, error, actualizarPerfil } = usePerfil()

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <ContextNav
        crumbs={[
          { label: "Inicio", href: "/app/dashboard" },
          { label: "Perfil" },
        ]}
      />

      <PageHeader
        eyebrow="Cuenta"
        title="Perfil"
        description="Tu espacio personal para revisar identidad, actualizar datos y administrar el estado de tu cuenta."
      />

      {error ? (
        <div className="rounded-[1.25rem] bg-[color:var(--surface-lowest)] px-4 py-4 shadow-[var(--shadow-airy)] sm:px-5">
          <p className="font-label text-[0.65rem] uppercase tracking-[0.2em] text-[color:var(--destructive)]">
            Aviso
          </p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--destructive)]">{error}</p>
        </div>
      ) : null}

      <PerfilSummaryCard perfil={perfil} loading={loading} />

      {perfil ? (
        <>
          <PerfilEditForm
            perfil={perfil}
            submitting={submitting}
            onSubmit={actualizarPerfil}
          />
        </>
      ) : null}
    </div>
  )
}
