const clpFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
})

const clpCompactFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  notation: "compact",
  maximumFractionDigits: 1,
})

/** $12.345 — montos en pesos chilenos, sin decimales. */
export const formatCLP = (value: number) => clpFormatter.format(value)

/** $1,2 M — para ejes y etiquetas donde no cabe el monto completo. */
export const formatCLPCompact = (value: number) => clpCompactFormatter.format(value)
