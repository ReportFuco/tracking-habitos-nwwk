export class InvalidNumericInputError extends Error {
  constructor(public readonly rawValue: string) {
    super(`Valor numerico invalido: "${rawValue}"`)
    this.name = "InvalidNumericInputError"
  }
}

/**
 * Convierte un string de input numerico opcional. Distingue:
 * - string vacio (o solo espacios) -> null (sin valor)
 * - numero finito (incluyendo 0 y negativos) -> number
 * - cualquier otra cosa -> lanza InvalidNumericInputError
 *
 * Reemplaza el patron `Number(x) || null`, que convierte 0 en null
 * y enmascara entradas invalidas.
 */
export const parseOptionalNumber = (value: string): number | null => {
  const trimmed = value.trim()
  if (trimmed === "") return null
  const num = Number(trimmed)
  if (!Number.isFinite(num)) {
    throw new InvalidNumericInputError(value)
  }
  return num
}

/**
 * Variante para campos numericos requeridos. string vacio o invalido lanza error.
 */
export const parseRequiredNumber = (value: string): number => {
  const parsed = parseOptionalNumber(value)
  if (parsed === null) {
    throw new InvalidNumericInputError(value)
  }
  return parsed
}
