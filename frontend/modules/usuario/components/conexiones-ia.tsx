"use client"

import { FormEvent, useState } from "react"
import { Copy, KeyRound } from "lucide-react"
import { toast } from "sonner"
import { ChipSelect } from "@/components/forms/chip-select"
import { FieldGroup, FormNote, FormPanel } from "@/components/forms/editorial-form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { formatShortDate } from "@/lib/dates"
import { getMcpUrl } from "@/modules/usuario/api/api-keys.api"
import { useApiKeys } from "@/modules/usuario/hooks/useApiKeys"
import { useConexionesOAuth } from "@/modules/usuario/hooks/useConexionesOAuth"
import { apiKeyCreateSchema } from "@/modules/usuario/schemas/api-key.schema"

type Permiso = "finanzas:read" | "finanzas:write"

type PorRevocar = { tipo: "key" | "app"; id: number; nombre: string }

const PERMISOS = [
  { value: "finanzas:read", label: "Solo lectura", hint: "consulta" },
  { value: "finanzas:write", label: "Lectura y escritura", hint: "registra y edita" },
]

const SCOPE_LABELS: Record<string, string> = {
  "*": "Acceso total",
  "finanzas:read": "Finanzas · lectura",
  "finanzas:write": "Finanzas · lectura y escritura",
}

// Escribir incluye leer: si estan ambos, basta con mostrar el de escritura.
const describirScopes = (scopes: string[]) =>
  scopes
    .filter((scope) => !(scope === "finanzas:read" && scopes.includes("finanzas:write")))
    .map((scope) => SCOPE_LABELS[scope] ?? scope)
    .join(", ")

const describirUso = (fecha: string | null) =>
  fecha ? `Ultimo uso: ${formatShortDate(fecha)}` : "Sin usar todavia"

const copiar = async (texto: string, que: string) => {
  try {
    await navigator.clipboard.writeText(texto)
    toast.success(`${que} copiado`)
  } catch {
    toast.error("No pudimos copiar", { description: "Selecciona el texto y copialo a mano." })
  }
}

function BloqueCopiable({ etiqueta, texto }: { etiqueta: string; texto: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-label text-[0.64rem] uppercase tracking-[0.2em] text-muted-foreground">{etiqueta}</p>
        <Button type="button" variant="ghost" size="sm" onClick={() => void copiar(texto, etiqueta)}>
          <Copy aria-hidden />
          Copiar
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-md bg-[color:var(--surface-variant)] px-3 py-2.5 font-mono text-xs leading-5 break-all whitespace-pre-wrap text-foreground">
        {texto}
      </pre>
    </div>
  )
}

function Subtitulo({ children }: { children: string }) {
  return (
    <h3 className="font-label text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">{children}</h3>
  )
}

function FilaConexion({
  nombre,
  detalle,
  uso,
  revocando,
  onRevocar,
}: {
  nombre: string
  detalle: string
  uso: string
  revocando: boolean
  onRevocar: () => void
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-3 sm:px-4">
      <div className="min-w-0">
        <p className="truncate font-semibold">{nombre}</p>
        <p className="text-xs text-muted-foreground">{detalle}</p>
        <p className="text-xs text-muted-foreground">{uso}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="shrink-0 text-[color:var(--destructive)]"
        disabled={revocando}
        onClick={onRevocar}
      >
        Revocar
      </Button>
    </li>
  )
}

export function ConexionesIA() {
  const apiKeys = useApiKeys()
  const apps = useConexionesOAuth()
  const [nombre, setNombre] = useState("")
  const [permiso, setPermiso] = useState<Permiso>("finanzas:read")
  const [creada, setCreada] = useState<{ secreto: string; mcpUrl: string } | null>(null)
  const [porRevocar, setPorRevocar] = useState<PorRevocar | null>(null)
  const revocando = apiKeys.revokingId !== null || apps.revokingId !== null
  // El componente solo se monta en el cliente (Perfil espera el perfil del usuario).
  const mcpUrl = getMcpUrl()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsed = apiKeyCreateSchema.safeParse({ nombre, scopes: [permiso] })
    if (!parsed.success) {
      toast.error("Revisa el formulario", { description: parsed.error.issues[0]?.message })
      return
    }

    const result = await apiKeys.crearKey(parsed.data)
    if (!result.ok) {
      toast.error("No pudimos crear la clave", { description: result.message })
      return
    }
    setNombre("")
    setCreada({ secreto: result.secreto, mcpUrl })
  }

  const handleRevocar = async () => {
    if (!porRevocar) return
    const result =
      porRevocar.tipo === "key"
        ? await apiKeys.revocarKey(porRevocar.id)
        : await apps.revocarConexion(porRevocar.id)
    if (result.ok) {
      toast.success("Acceso revocado")
      setPorRevocar(null)
    } else {
      toast.error("No pudimos revocar el acceso", { description: result.message })
    }
  }

  return (
    <FormPanel
      eyebrow="Integraciones"
      title="Conexiones con IA"
      description="Conecta Claude, ChatGPT u otro asistente a tus finanzas para preguntarle por tus gastos o registrarlos conversando."
      aside={
        <div className="space-y-4">
          <div>
            <p className="font-label text-[0.64rem] uppercase tracking-[0.2em] text-muted-foreground">Como funciona</p>
            <p className="mt-2 text-sm leading-6 text-foreground/80">
              Los asistentes se conectan por MCP, el estandar abierto para dar herramientas a un modelo. Tu decides
              si solo pueden leer o tambien registrar.
            </p>
          </div>
          <div>
            <p className="font-label text-[0.64rem] uppercase tracking-[0.2em] text-muted-foreground">Consejo</p>
            <p className="mt-2 text-sm leading-6 text-foreground/80">
              Cada conexion se revoca por separado: si pierdes un dispositivo, cortas solo esa.
            </p>
          </div>
        </div>
      }
    >
      <div className="space-y-8">
        <section className="space-y-3">
          <Subtitulo>Claude.ai, ChatGPT y apps web</Subtitulo>
          <p className="text-sm leading-6 text-muted-foreground">
            Agrega un conector personalizado con esta direccion. La app te traera aqui para que autorices el acceso;
            no necesitas crear una clave.
          </p>
          <BloqueCopiable etiqueta="Direccion del servidor" texto={mcpUrl} />
        </section>

        <section className="space-y-3">
          <Subtitulo>Clave para Claude Code, Cursor y scripts</Subtitulo>
          {creada ? (
            <div className="space-y-4 rounded-xl border-2 border-foreground p-4 sm:p-5" role="status">
              <div>
                <p className="font-semibold">Copia tu clave ahora</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Por seguridad no se vuelve a mostrar. Si la pierdes, revocala y crea otra.
                </p>
              </div>
              <BloqueCopiable etiqueta="Clave" texto={creada.secreto} />
              <BloqueCopiable
                etiqueta="Comando para Claude Code"
                texto={`claude mcp add --transport http ritmo-finanzas ${creada.mcpUrl} --header "Authorization: Bearer ${creada.secreto}"`}
              />
              <p className="text-sm text-muted-foreground">
                En otros clientes, agrega un servidor MCP con la direccion de arriba y el header{" "}
                <code className="font-mono text-xs">Authorization: Bearer</code> seguido de la clave.
              </p>
              <Button type="button" onClick={() => setCreada(null)}>
                Listo, ya la copie
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <FieldGroup label="Nombre" hint="Para reconocerla despues">
                <Input
                  id="conexion-nombre"
                  value={nombre}
                  maxLength={80}
                  placeholder="Claude Code en el notebook"
                  onChange={(event) => setNombre(event.target.value)}
                  className="h-13 rounded-lg border-0 bg-[color:var(--surface-variant)] px-4 shadow-none focus-visible:border-b-2 focus-visible:border-primary focus-visible:ring-0"
                />
              </FieldGroup>

              <FieldGroup label="Permisos">
                <ChipSelect
                  label="Permisos de la clave"
                  options={PERMISOS}
                  value={permiso}
                  onChange={(value) => setPermiso(value as Permiso)}
                />
              </FieldGroup>

              <FormNote>
                {permiso === "finanzas:read"
                  ? "El asistente podra consultar tus cuentas, movimientos y resumenes, pero no cambiar nada."
                  : "El asistente tambien podra registrar, editar y eliminar movimientos. Sus instrucciones le piden confirmar contigo antes de borrar."}
              </FormNote>

              <Button
                type="submit"
                size="lg"
                className="h-12 rounded-xl px-6 text-sm font-semibold"
                disabled={apiKeys.creating}
              >
                <KeyRound aria-hidden />
                {apiKeys.creating ? "Creando..." : "Crear clave"}
              </Button>
            </form>
          )}
        </section>

        <section className="space-y-3">
          <Subtitulo>Apps conectadas</Subtitulo>
          {apps.error ? <p className="text-sm text-[color:var(--destructive)]">{apps.error}</p> : null}
          {apps.loading && apps.conexiones.length === 0 ? (
            <div className="h-16 animate-pulse rounded-lg bg-[color:var(--surface-low)]" aria-hidden />
          ) : apps.conexiones.length === 0 && !apps.error ? (
            <p className="text-sm text-muted-foreground">Ninguna app autorizada todavia.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {apps.conexiones.map((app) => (
                <FilaConexion
                  key={app.id_autorizacion}
                  nombre={app.cliente_nombre ?? "App sin nombre"}
                  detalle={`${describirScopes(app.scopes)} · autorizada el ${formatShortDate(app.created_at)}`}
                  uso={describirUso(app.last_used_at)}
                  revocando={apps.revokingId === app.id_autorizacion}
                  onRevocar={() =>
                    setPorRevocar({ tipo: "app", id: app.id_autorizacion, nombre: app.cliente_nombre ?? "esta app" })
                  }
                />
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <Subtitulo>Claves activas</Subtitulo>
          {apiKeys.error ? <p className="text-sm text-[color:var(--destructive)]">{apiKeys.error}</p> : null}
          {apiKeys.loading && apiKeys.keys.length === 0 ? (
            <div className="h-16 animate-pulse rounded-lg bg-[color:var(--surface-low)]" aria-hidden />
          ) : apiKeys.keys.length === 0 && !apiKeys.error ? (
            <p className="text-sm text-muted-foreground">No tienes claves activas.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {apiKeys.keys.map((key) => (
                <FilaConexion
                  key={key.id_api_key}
                  nombre={key.nombre}
                  detalle={`${describirScopes(key.scopes)} · ${key.key_prefix}…`}
                  uso={describirUso(key.last_used_at)}
                  revocando={apiKeys.revokingId === key.id_api_key}
                  onRevocar={() => setPorRevocar({ tipo: "key", id: key.id_api_key, nombre: key.nombre })}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      <Dialog open={porRevocar !== null} onOpenChange={(open) => !open && setPorRevocar(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Revocar «{porRevocar?.nombre}»?</DialogTitle>
            <DialogDescription>
              {porRevocar?.tipo === "app"
                ? "La app pierde el acceso de inmediato; para volver a usarla tendras que autorizarla de nuevo."
                : "Los asistentes que usen esta clave pierden el acceso de inmediato. No se puede deshacer."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => setPorRevocar(null)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" disabled={revocando} onClick={() => void handleRevocar()}>
              {revocando ? "Revocando..." : "Revocar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FormPanel>
  )
}
