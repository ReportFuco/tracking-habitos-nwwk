import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    // Mismo alias que tsconfig.json, para que los tests importen los modulos reales
    // en vez de una copia.
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    // jsdom aporta window/localStorage/navigator; fake-indexeddb aporta indexedDB, que
    // jsdom no implementa y que el persister necesita.
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
  },
})
