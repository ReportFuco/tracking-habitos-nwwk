import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "The Curated Life",
    short_name: "Curated Life",
    description:
      "Tu espacio personal para seguir finanzas, entrenamientos, compras y nutricion.",
    start_url: "/app/dashboard",
    scope: "/",
    lang: "es-CL",
    display: "standalone",
    background_color: "#f9faf2",
    theme_color: "#f9faf2",
    icons: [
      {
        src: "/icons/app-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
