import { describe, expect, it } from "vitest"

import {
  isItemActive,
  resolveVisibleItems,
  userBottomNavOrder,
} from "@/components/shell/mobile-bottom-nav"
import { adminBottomNavItems, userNavSections } from "@/components/shell/nav-items"

// AUD-004: el nav inferior admin quedaba vacio porque se filtraba con el orden de /app/...
describe("MobileBottomNav", () => {
  it("sin preferredOrder muestra los items admin tal como llegan", () => {
    expect(resolveVisibleItems(adminBottomNavItems)).toEqual(adminBottomNavItems)
  })

  it("con el orden de usuario deja los 5 modulos y saca Perfil", () => {
    const items = userNavSections.flatMap((section) => section.items)
    const visibles = resolveVisibleItems(items, userBottomNavOrder).map((item) => item.href)

    expect(visibles).toEqual(userBottomNavOrder)
  })

  it.each([
    ["/administrador/productos", "Catalogo"],
    ["/administrador/tablas-nutricionales/3", "Catalogo"],
    ["/administrador/locales", "Compras"],
    ["/administrador/finanzas/categorias", "Finanzas"],
    ["/administrador", "Resumen"],
  ])("%s activa %s", (pathname, label) => {
    const activos = adminBottomNavItems.filter((item) => isItemActive(item, pathname))

    expect(activos.map((item) => item.label)).toEqual([label])
  })

  it("una ruta fuera del nav no activa ningun item", () => {
    const activos = adminBottomNavItems.filter((item) =>
      isItemActive(item, "/administrador/entrenamientos/gimnasios"),
    )

    expect(activos).toEqual([])
  })
})
