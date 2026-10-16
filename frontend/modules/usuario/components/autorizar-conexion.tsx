"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { FormNote, FormPanel } from "@/components/forms/editorial-form"
import { PageHeader } from "@/components/shell/page-header"
import { Button } from "@/components/ui/button"
import { getFriendlyErrorMessage } from "@/lib/error-messages"
import { OAuthAPI } from "@/modules/usuario/api/oauth.api"
import type { SolicitudOAuth } from "@/modules/usuario/schemas/oauth.schema"
import {
  MODULOS,
  PERMISOS_INICIALES,
  PermisosModulos,
  describirPermisos,
  scopesDesdePermisos,
  type Modulo,
  type Permisos,
} from "./permisos-modulos"

// Modulos que pidio la app (con lectura) y los que pidio solo para leer.
const modulosDe = (solicitud: SolicitudOAuth) => {
  const disponibles = MODULOS.map(({ id }) => id).filter((id) =>
    solicitud.scopes_disponibles.includes(`${id}:read`),
  ) as Modulo[]
  const sinEscritura = disponibles.filter(
    (id) => !solicitud.scopes_disponibles.includes(`${id}:write`),
  )
  return { disponibles, sinEscritura }
}

type Estado =
  | { fase: "cargando" }
  | { fase: "error"; mensaje: string }
  | { fase: "lista"; solicitud: SolicitudOAuth }
  | { fase: "saliendo"; host: string }

export function AutorizarConexion() {
  const token = useSearchParams().get("solicitud")
  const [estado, setEstado] = useState<Estado>({ fase: "cargando" })
  const [permisos, setPermisos] = useState<Permisos>(PERMISOS_INICIALES)
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
        ? await OAuthAPI.aprobar(
            token,
            scopesDesdePermisos(permisos).filter((scope) =>
              estado.solicitud.scopes_disponibles.includes(scope),
            ),
          )
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
        description="Una aplicacion pide acceso a tus datos en Ritmo."
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
          description={`Si apruebas, volveras a ${estado.solicitud.redirect_host} y la aplicacion podra usar tus datos con los permisos que elijas.`}
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
              <PermisosModulos
                value={permisos}
                onChange={setPermisos}
                {...modulosDe(estado.solicitud)}
              />
            </div>

            <FormNote>
              {describirPermisos(permisos, modulosDe(estado.solicitud).disponibles)} Puedes revocar el
              acceso cuando quieras desde Perfil.
            </FormNote>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                size="lg"
                className="h-12 rounded-xl px-6 text-sm font-semibold"
                disabled={
                  enviando ||
                  !scopesDesdePermisos(permisos).some((scope) =>
                    estado.solicitud.scopes_disponibles.includes(scope),
                  )
                }
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
