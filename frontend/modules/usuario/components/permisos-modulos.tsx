"use client"

import { ChipSelect } from "@/components/forms/chip-select"

/**
 * Permisos de una conexion con IA, modulo por modulo: sin acceso, solo lectura o lectura y
 * escritura. Lo usan la creacion de claves y la pantalla de autorizacion OAuth.
 */

export const MODULOS = [
  {
    id: "finanzas",
    nombre: "Finanzas",
    lectura: "consultar cuentas, movimientos y resumenes",
    escritura: "registrar, editar y eliminar movimientos",
  },
  {
    id: "entrenamientos",
    nombre: "Entrenamientos",
    lectura: "consultar tus sesiones, progreso y carga por musculo",
    escritura: "dejarte notas de seguimiento y sugerencias",
  },
] as const

export type Modulo = (typeof MODULOS)[number]["id"]
export type NivelPermiso = "ninguno" | "lectura" | "escritura"
export type Permisos = Record<Modulo, NivelPermiso>

export const PERMISOS_INICIALES: Permisos = { finanzas: "lectura", entrenamientos: "lectura" }

/** Escribir incluye leer: se mandan ambos para que quede explicito. */
export const scopesDesdePermisos = (permisos: Permisos): string[] =>
  MODULOS.flatMap(({ id }) =>
    permisos[id] === "escritura"
      ? [`${id}:read`, `${id}:write`]
      : permisos[id] === "lectura"
        ? [`${id}:read`]
        : [],
  )

export const describirPermisos = (permisos: Permisos, disponibles?: Modulo[]): string => {
  const partes = MODULOS.filter(({ id }) => !disponibles || disponibles.includes(id))
    .filter(({ id }) => permisos[id] !== "ninguno")
    .map((modulo) =>
      permisos[modulo.id] === "escritura"
        ? `${modulo.nombre}: ${modulo.lectura} y ${modulo.escritura}.`
        : `${modulo.nombre}: ${modulo.lectura}, sin cambiar nada.`,
    )
  return partes.length > 0 ? partes.join(" ") : "Elige al menos un modulo."
}

export function PermisosModulos({
  value,
  onChange,
  disponibles,
  sinEscritura = [],
}: {
  value: Permisos
  onChange: (permisos: Permisos) => void
  /** Modulos que se pueden elegir. Por defecto, todos. */
  disponibles?: Modulo[]
  /** Modulos donde solo se ofrece lectura (la app no pidio escritura). */
  sinEscritura?: Modulo[]
}) {
  return (
    <div className="space-y-4">
      {MODULOS.filter(({ id }) => !disponibles || disponibles.includes(id)).map((modulo) => (
        <div key={modulo.id} className="space-y-2">
          <p className="text-sm font-medium">{modulo.nombre}</p>
          <ChipSelect
            label={`Permisos de ${modulo.nombre.toLowerCase()}`}
            options={[
              { value: "ninguno", label: "Sin acceso" },
              { value: "lectura", label: "Solo lectura", hint: "consulta" },
              ...(sinEscritura.includes(modulo.id)
                ? []
                : [{ value: "escritura", label: "Lectura y escritura", hint: "registra" }]),
            ]}
            value={value[modulo.id]}
            onChange={(nivel) => onChange({ ...value, [modulo.id]: nivel as NivelPermiso })}
          />
        </div>
      ))}
    </div>
  )
}
