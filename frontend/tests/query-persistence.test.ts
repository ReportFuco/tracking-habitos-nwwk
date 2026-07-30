import { QueryClient } from "@tanstack/react-query"
import {
  persistQueryClientRestore,
  persistQueryClientSubscribe,
} from "@tanstack/query-persist-client-core"
import { afterEach, describe, expect, it } from "vitest"

import {
  QUERY_CACHE_SCHEMA_VERSION,
  clearPersistedQueryCache,
  createQueryPersister,
} from "@/lib/query-persistence"

const ONE_WEEK = 1000 * 60 * 60 * 24 * 7
const LEGACY_LOCALSTORAGE_KEY = "tcl-query-cache-v1"

// El persister real usa throttleTime 1000, asi que hay que darle tiempo a escribir.
const esperarEscritura = () => new Promise((resolve) => setTimeout(resolve, 1200))

const shouldDehydrateQuery = (query: { meta?: Record<string, unknown> }) =>
  query.meta?.persist === true

// maxAge solo interviene al restaurar, por eso no va en la suscripcion.
const suscribir = (queryClient: QueryClient, persister: ReturnType<typeof createQueryPersister>) =>
  persistQueryClientSubscribe({
    queryClient,
    persister,
    buster: QUERY_CACHE_SCHEMA_VERSION,
    dehydrateOptions: { shouldDehydrateQuery },
  })

afterEach(async () => {
  await clearPersistedQueryCache()
})

describe("persistencia del cache de queries en IndexedDB", () => {
  it("guarda solo las queries marcadas con meta.persist", async () => {
    const persister = createQueryPersister()
    const queryClient = new QueryClient()
    const unsubscribe = suscribir(queryClient, persister)

    await queryClient.fetchQuery({
      queryKey: ["perfil"],
      queryFn: async () => ({ email: "persistido@mail.com" }),
      meta: { persist: true },
    })
    await queryClient.fetchQuery({
      queryKey: ["efimero"],
      queryFn: async () => ({ email: "no-persistir@mail.com" }),
    })
    await esperarEscritura()
    unsubscribe()

    const restaurado = new QueryClient()
    await persistQueryClientRestore({
      queryClient: restaurado,
      persister,
      buster: QUERY_CACHE_SCHEMA_VERSION,
      maxAge: ONE_WEEK,
    })

    expect(restaurado.getQueryData(["perfil"])).toEqual({ email: "persistido@mail.com" })
    expect(restaurado.getQueryData(["efimero"])).toBeUndefined()
  })

  it("al cerrar sesion no deja datos del usuario anterior", async () => {
    // queryClient.clear() es lo que hace useAuth.logout. Es la garantia de que los datos
    // de una cuenta no queden visibles para la siguiente en el mismo dispositivo.
    const persister = createQueryPersister()
    const queryClient = new QueryClient()
    const unsubscribe = suscribir(queryClient, persister)

    await queryClient.fetchQuery({
      queryKey: ["perfil"],
      queryFn: async () => ({ email: "usuario-A@mail.com" }),
      meta: { persist: true },
    })
    await esperarEscritura()

    queryClient.clear()
    await esperarEscritura()
    unsubscribe()

    const siguienteUsuario = new QueryClient()
    await persistQueryClientRestore({
      queryClient: siguienteUsuario,
      persister,
      buster: QUERY_CACHE_SCHEMA_VERSION,
      maxAge: ONE_WEEK,
    })

    expect(siguienteUsuario.getQueryData(["perfil"])).toBeUndefined()
  })

  it("descarta lo guardado cuando cambia la version del esquema", async () => {
    const persister = createQueryPersister()
    const queryClient = new QueryClient()
    const unsubscribe = persistQueryClientSubscribe({
      queryClient,
      persister,
      buster: "version-anterior",
      dehydrateOptions: { shouldDehydrateQuery },
    })

    await queryClient.fetchQuery({
      queryKey: ["catalogo"],
      queryFn: async () => ({ forma: "antigua" }),
      meta: { persist: true },
    })
    await esperarEscritura()
    unsubscribe()

    const restaurado = new QueryClient()
    await persistQueryClientRestore({
      queryClient: restaurado,
      persister,
      buster: QUERY_CACHE_SCHEMA_VERSION,
      maxAge: ONE_WEEK,
    })

    expect(restaurado.getQueryData(["catalogo"])).toBeUndefined()
  })

  it("clearPersistedQueryCache limpia tambien el storage legado de localStorage", async () => {
    window.localStorage.setItem(LEGACY_LOCALSTORAGE_KEY, JSON.stringify({ viejo: true }))

    await clearPersistedQueryCache()

    expect(window.localStorage.getItem(LEGACY_LOCALSTORAGE_KEY)).toBeNull()
  })
})
