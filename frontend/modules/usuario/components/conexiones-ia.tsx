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
import { apiKeyCreateSchema, type ApiKey } from "@/modules/usuario/schemas/api-key.schema"

type Permiso = "finanzas:read" | "finanzas:write"

const PERMISOS = [
  { value: "finanzas:read", label: "Solo lectura", hint: "consulta" },
  { value: "finanzas:write", label: "Lectura y escritura", hint: "registra y edita" },
]

const SCOPE_LABELS: Record<string, string> = {
  "*": "Acceso total",
  "finanzas:read": "Finanzas · lectura",
  "finanzas:write": "Finanzas · lectura y escritura",
}

const describirScopes = (scopes: string[]) =>
  scopes.map((scope) => SCOPE_LABELS[scope] ?? scope).join(", ")

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

export function ConexionesIA() {
  const { keys, loading, creating, revokingId, error, crearKey, revocarKey } = useApiKeys()
  const [nombre, setNombre] = useState("")
  const [permiso, setPermiso] = useState<Permiso>("finanzas:read")
  const [creada, setCreada] = useState<{ secreto: string; mcpUrl: string } | null>(null)
  const [porRevocar, setPorRevocar] = useState<ApiKey | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsed = apiKeyCreateSchema.safeParse({ nombre, scopes: [permiso] })
    if (!parsed.success) {
      toast.error("Revisa el formulario", { description: parsed.error.issues[0]?.message })
      return
    }

    const result = await crearKey(parsed.data)
    if (!result.ok) {
      toast.error("No pudimos crear la conexion", { description: result.message })
      return
    }
    setNombre("")
    setCreada({ secreto: result.secreto, mcpUrl: getMcpUrl() })
  }

  const handleRevocar = async () => {
    if (!porRevocar) return
    const result = await revocarKey(porRevocar.id_api_key)
    if (result.ok) {
      toast.success("Conexion revocada")
      setPorRevocar(null)
    } else {
      toast.error("No pudimos revocar la conexion", { description: result.message })
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
              Los asistentes se conectan por MCP, el estandar abierto para dar herramientas a un modelo. Cada
              conexion usa su propia clave.
            </p>
          </div>
          <div>
            <p className="font-label text-[0.64rem] uppercase tracking-[0.2em] text-muted-foreground">Consejo</p>
            <p className="mt-2 text-sm leading-6 text-foreground/80">
              Crea una clave por asistente o dispositivo: si uno se pierde, revocas solo esa.
            </p>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {creada ? (
          <div className="space-y-4 rounded-xl border-2 border-foreground p-4 sm:p-5" role="status">
            <div>
              <p className="font-semibold">Copia tu clave ahora</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Por seguridad no se vuelve a mostrar. Si la pierdes, revocala y crea otra.
              </p>
            </div>
            <BloqueCopiable etiqueta="Clave" texto={creada.secreto} />
            <BloqueCopiable etiqueta="Direccion del servidor" texto={creada.mcpUrl} />
            <BloqueCopiable
              etiqueta="Comando para Claude Code"
              texto={`claude mcp add --transport http ritmo-finanzas ${creada.mcpUrl} --header "Authorization: Bearer ${creada.secreto}"`}
            />
            <p className="text-sm text-muted-foreground">
              En otros asistentes, agrega un servidor MCP con esa direccion y el header{" "}
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
                placeholder="Claude en el notebook"
                onChange={(event) => setNombre(event.target.value)}
                className="h-13 rounded-lg border-0 bg-[color:var(--surface-variant)] px-4 shadow-none focus-visible:border-b-2 focus-visible:border-primary focus-visible:ring-0"
              />
            </FieldGroup>

            <FieldGroup label="Permisos">
              <ChipSelect
                label="Permisos de la conexion"
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

            <Button type="submit" size="lg" className="h-12 rounded-xl px-6 text-sm font-semibold" disabled={creating}>
              <KeyRound aria-hidden />
              {creating ? "Creando..." : "Crear clave"}
            </Button>
          </form>
        )}

        <div className="space-y-3">
          <h3 className="font-label text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
            Conexiones activas
          </h3>
          {error ? <p className="text-sm text-[color:var(--destructive)]">{error}</p> : null}
          {loading && keys.length === 0 ? (
            <div className="h-16 animate-pulse rounded-lg bg-[color:var(--surface-low)]" aria-hidden />
          ) : keys.length === 0 && !error ? (
            <p className="text-sm text-muted-foreground">Todavia no conectas ningun asistente.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {keys.map((key) => (
                <li key={key.id_api_key} className="flex items-center justify-between gap-3 px-3 py-3 sm:px-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{key.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {describirScopes(key.scopes)} ·{" "}
                      <span className="font-mono">{key.key_prefix}…</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {key.last_used_at ? `Ultimo uso: ${formatShortDate(key.last_used_at)}` : "Sin usar todavia"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-[color:var(--destructive)]"
                    disabled={revokingId === key.id_api_key}
                    onClick={() => setPorRevocar(key)}
                  >
                    Revocar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Dialog open={porRevocar !== null} onOpenChange={(open) => !open && setPorRevocar(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Revocar «{porRevocar?.nombre}»?</DialogTitle>
            <DialogDescription>
              Los asistentes que usen esta clave pierden el acceso de inmediato. No se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => setPorRevocar(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={revokingId !== null}
              onClick={() => void handleRevocar()}
            >
              {revokingId !== null ? "Revocando..." : "Revocar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FormPanel>
  )
}
