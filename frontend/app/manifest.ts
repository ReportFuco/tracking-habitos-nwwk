import type { MetadataRoute } from "next"
import { BRAND } from "@/lib/brand"

const ICON_192 = { src: "/icons/app-icon-192.png", sizes: "192x192", type: "image/png" }

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: BRAND.name,
    short_name: BRAND.name,
    description: BRAND.description,
    start_url: "/app/dashboard",
    scope: "/",
    lang: "es-CL",
    display: "standalone",
    orientation: "portrait",
    // Splash negro con el pulso en sol: el mismo bloque del icono.
    background_color: BRAND.colors.ink,
    theme_color: BRAND.colors.ink,
    categories: ["finance", "health", "lifestyle", "productivity"],
    icons: [
      { ...ICON_192, purpose: "any" },
      { src: "/icons/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // El trazo queda dentro de la zona segura (80% central), sirve como maskable.
      { src: "/icons/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Accesos al mantener presionado el icono de la app instalada.
    shortcuts: [
      {
        name: "Anotar gasto",
        short_name: "Gasto",
        url: "/app/finanzas/registrar-movimiento",
        icons: [ICON_192],
      },
      {
        name: "Entrenar",
        short_name: "Entrenar",
        url: "/app/entrenamientos/iniciar-fuerza",
        icons: [ICON_192],
      },
      {
        name: "Registrar peso",
        short_name: "Peso",
        url: "/app/nutricion/peso",
        icons: [ICON_192],
      },
    ],
  }
}
