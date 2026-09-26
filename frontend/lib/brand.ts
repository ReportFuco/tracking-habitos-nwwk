// Fuente unica de identidad: nombre, textos y colores que salen de la app hacia el
// sistema (metadata, manifest de la PWA, notificaciones). public/sw.js no puede importar
// este archivo; si cambia el nombre, actualizar tambien su fallback de notificaciones.
export const BRAND = {
  name: "Ritmo",
  tagline: "Tu vida, en bloques.",
  description: "Finanzas, entrenamientos, compras y nutricion en un solo lugar.",
  colors: {
    ink: "#111111",
    sun: "#f2b705",
    paper: "#f4f4f2",
  },
} as const
