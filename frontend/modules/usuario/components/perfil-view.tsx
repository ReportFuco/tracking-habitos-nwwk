"use client"

import { ContextNav } from "@/components/shell/context-nav"
import { PageHeader } from "@/components/shell/page-header"
import { ThemeToggle } from "@/components/theme/theme-toggle"
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
        <div className="rounded-xl bg-[color:var(--surface-lowest)] px-4 py-4 shadow-[var(--shadow-airy)] sm:px-5">
          <p className="font-label text-[0.65rem] uppercase tracking-[0.2em] text-[color:var(--destructive)]">
            Aviso
          </p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--destructive)]">{error}</p>
        </div>
      ) : null}

      <PerfilSummaryCard perfil={perfil} loading={loading} />

      <section
        aria-labelledby="apariencia-titulo"
        className="flex flex-col gap-3 rounded-2xl bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:flex-row sm:items-center sm:justify-between sm:p-5"
      >
        <div>
          <h2 id="apariencia-titulo" className="text-base font-semibold">
            Apariencia
          </h2>
          <p className="text-sm text-muted-foreground">
            Modo claro, oscuro o el que use tu telefono.
          </p>
        </div>
        <ThemeToggle />
      </section>

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
