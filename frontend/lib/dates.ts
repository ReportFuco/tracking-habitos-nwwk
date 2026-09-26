// Fechas "de calendario" en la zona de Chile. `toISOString()` usa UTC y en la noche
// chilena ya devuelve el dia siguiente; estas funciones trabajan con YYYY-MM-DD locales.
export const APP_TIME_ZONE = "America/Santiago"

const isoDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/** YYYY-MM-DD del instante dado, en hora de Chile. */
export function toLocalIsoDate(date: Date = new Date()): string {
  return isoDateFormatter.format(date)
}

/** Parte de fecha de un valor del backend ("2026-09-24T18:00:00" o "2026-09-24"). */
export function datePart(value: string): string {
  return value.slice(0, 10)
}

/** Suma dias a una fecha YYYY-MM-DD sin pasar por la zona horaria del navegador. */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return date.toISOString().slice(0, 10)
}

/** Lunes (YYYY-MM-DD) de la semana de `isoDate`. */
export function startOfWeek(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = domingo
  return addDays(isoDate, -((dow + 6) % 7))
}

/** "24 sep" a partir de YYYY-MM-DD, sin desfase de zona horaria. */
export function formatShortDate(isoDate: string): string {
  const [y, m, d] = datePart(isoDate).split("-").map(Number)
  return new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, d)))
    .replace(".", "")
}

/** "septiembre" o "sept 2026" para un año/mes. */
export function formatMonth(year: number, month: number, style: "long" | "short" = "long"): string {
  return new Intl.DateTimeFormat("es-CL", { month: style, timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, 1)))
    .replace(".", "")
}

/** "Sábado 26 de septiembre" para hoy en Chile. */
export function formatLongToday(date: Date = new Date()): string {
  const text = new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: APP_TIME_ZONE,
  }).format(date)
  return text.charAt(0).toUpperCase() + text.slice(1)
}
