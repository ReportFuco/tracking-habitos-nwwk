export const queryKeys = {
  auth: {
    profile: ["auth", "profile"] as const,
  },
  finanzas: {
    bancos: ["finanzas", "bancos"] as const,
    categorias: ["finanzas", "categorias"] as const,
    cuentas: ["finanzas", "cuentas"] as const,
    movimientos: ["finanzas", "movimientos"] as const,
    movimientosPage: (offset: number, limit: number) =>
      ["finanzas", "movimientos", { offset, limit }] as const,
    analitica: ["finanzas", "analitica"] as const,
    analiticaResumen: (params?: { year?: number; month?: number }) =>
      ["finanzas", "analitica", "resumen", params ?? {}] as const,
    productosRoot: ["finanzas", "productos"] as const,
    productos: (idBanco: number) => ["finanzas", "productos", { idBanco }] as const,
  },
  entrenamientos: {
    ejerciciosRoot: ["entrenamientos", "ejercicios"] as const,
    ejercicios: (params?: {
      q?: string
      id_musculo?: number
      id_subcategoria_musculo?: number
      equipamiento?: string
      tipo?: string
    }) =>
      ["entrenamientos", "ejercicios", params ?? {}] as const,
    equipamientos: ["entrenamientos", "equipamientos"] as const,
    musculos: ["entrenamientos", "musculos"] as const,
    gimnasiosRoot: ["entrenamientos", "gimnasios"] as const,
    gimnasios: (q?: string) => ["entrenamientos", "gimnasios", { q: q ?? "" }] as const,
    fuerzaLista: ["entrenamientos", "fuerza", "lista"] as const,
    fuerzaActivo: ["entrenamientos", "fuerza", "activo"] as const,
    fuerzaDetalle: (id: number) => ["entrenamientos", "fuerza", "detalle", id] as const,
  },
  nutricion: {
    consumos: ["nutricion", "consumos"] as const,
    metas: ["nutricion", "metas"] as const,
    pesos: ["nutricion", "pesos"] as const,
    tablas: ["nutricion", "tablas"] as const,
  },
  compras: {
    cadenas: ["compras", "cadenas"] as const,
    locales: ["compras", "locales"] as const,
    compras: ["compras", "compras"] as const,
  },
  catalogo: {
    marcas: ["catalogo", "marcas"] as const,
    productosRoot: ["catalogo", "productos"] as const,
    productos: (params?: { q?: string }) =>
      ["catalogo", "productos", params ?? {}] as const,
  },
}
