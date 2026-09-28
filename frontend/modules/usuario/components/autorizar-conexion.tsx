"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { ChipSelect } from "@/components/forms/chip-select"
import { FormNote, FormPanel } from "@/components/forms/editorial-form"
import { PageHeader } from "@/components/shell/page-header"
import { Button } from "@/components/ui/button"
import { getFriendlyErrorMessage } from "@/lib/error-messages"
import { OAuthAPI } from "@/modules/usuario/api/oauth.api"
import type { SolicitudOAuth } from "@/modules/usuario/schemas/oauth.schema"

type Permiso = "lectura" | "escritura"

const SCOPES_POR_PERMISO: Record<Permiso, string[]> = {
  lectura: ["finanzas:read"],
  escritura: ["finanzas:read", "finanzas:write"],
}

type Estado =
  | { fase: "cargando" }
  | { fase: "error"; mensaje: string }
  | { fase: "lista"; solicitud: SolicitudOAuth }
  | { fase: "saliendo"; host: string }

export function AutorizarConexion() {
  const token = useSearchParams().get("solicitud")
  const [estado, setEstado] = useState<Estado>({ fase: "cargando" })
  const [permiso, setPermiso] = useState<Permiso>("lectura")
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!token) {
      const timer = setTimeout(() => setEstado({ fase: "error", mensaje: "Falta la solicitud de conexion." }), 0)
      return () => clearTimeout(timer)
    }
    let vigente = true
    OAuthAPI.getSolicitud(token)
      .then((solicitud) => vigente && setEstado({ fase: "lista", solicitud }))
      .catch((err) => vigente && setEstado({ fase: "error", mensaje: getFriendlyErrorMessage(err) }))
    return () => {
      vigente = false
    }
  }, [token])

  const decidir = async (aprobar: boolean) => {
    if (!token || estado.fase !== "lista") return
    setEnviando(true)
    try {
      const url = aprobar
        ? await OAuthAPI.aprobar(token, SCOPES_POR_PERMISO[permiso])
        : await OAuthAPI.rechazar(token)
      setEstado({ fase: "saliendo", host: estado.solicitud.redirect_host })
      window.location.assign(url)
    } catch (err) {
      toast.error("No pudimos completar la conexion", { description: getFriendlyErrorMessage(err) })
      setEnviando(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 sm:gap-6">
      <PageHeader
        eyebrow="Conexiones con IA"
        title="Autorizar conexion"
        description="Una aplicacion pide acceso a tus finanzas en Ritmo."
      />

      {estado.fase === "cargando" ? (
        <div className="h-64 animate-pulse rounded-2xl bg-[color:var(--surface-low)]" aria-hidden />
      ) : null}

      {estado.fase === "error" ? (
        <FormPanel eyebrow="No se pudo continuar">
          <p className="text-sm text-[color:var(--destructive)]">{estado.mensaje}</p>
          <p className="mt-3 text-sm text-muted-foreground">
            Vuelve a iniciar la conexion desde tu asistente. Tus conexiones estan en{" "}
            <Link href="/app/perfil" className="font-semibold underline underline-offset-4">
              Perfil
            </Link>
            .
          </p>
        </FormPanel>
      ) : null}

      {estado.fase === "saliendo" ? (
        <FormPanel eyebrow="Listo">
          <p className="text-sm">Volviendo a {estado.host}…</p>
        </FormPanel>
      ) : null}

      {estado.fase === "lista" ? (
        <FormPanel
          eyebrow="Solicitud de acceso"
          title={`${estado.solicitud.cliente_nombre ?? "Una aplicacion"} quiere conectarse`}
          description={`Si apruebas, volveras a ${estado.solicitud.redirect_host} y la aplicacion podra usar tus datos de finanzas con los permisos que elijas.`}
        >
          <div className="space-y-5">
            <div className="flex gap-3 rounded-lg bg-[color:var(--surface-low)] p-3 sm:p-4">
              <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
              <p className="text-sm leading-6">
                El nombre lo declara la propia aplicacion. Aprueba solo si tu iniciaste esta conexion y
                confias en <span className="font-semibold">{estado.solicitud.redirect_host}</span>.
              </p>
            </div>

            <div className="space-y-2">
              <p className="font-label text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">Permisos</p>
              <ChipSelect
                label="Permisos de la conexion"
                options={[
                  { value: "lectura", label: "Solo lectura", hint: "consulta" },
                  ...(estado.solicitud.scopes_disponibles.includes("finanzas:write")
                    ? [{ value: "escritura", label: "Lectura y escritura", hint: "registra y edita" }]
                    : []),
                ]}
                value={permiso}
                onChange={(value) => setPermiso(value as Permiso)}
              />
            </div>

            <FormNote>
              {permiso === "lectura"
                ? "Podra consultar tus cuentas, movimientos y resumenes, pero no cambiar nada."
                : "Tambien podra registrar, editar y eliminar movimientos."}{" "}
              Puedes revocar el acceso cuando quieras desde Perfil.
            </FormNote>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                size="lg"
                className="h-12 rounded-xl px-6 text-sm font-semibold"
                disabled={enviando}
                onClick={() => void decidir(true)}
              >
                {enviando ? "Conectando..." : "Autorizar"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-12 rounded-xl px-4 text-sm"
                disabled={enviando}
                onClick={() => void decidir(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </FormPanel>
      ) : null}
    </div>
  )
}
