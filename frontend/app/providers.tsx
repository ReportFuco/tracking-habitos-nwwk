"use client"

import { useEffect, useMemo, useState, useSyncExternalStore } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client"
import {
  QUERY_CACHE_SCHEMA_VERSION,
  createQueryPersister,
  requestPersistentStorage,
} from "@/lib/query-persistence"
import {
  ENTRENO_ACTIVO_SCOPE_ID,
  registerEntrenamientosMutationDefaults,
} from "@/modules/entrenamientos/offline/entrenamientos-offline"
import {
  MOVIMIENTOS_OFFLINE_SCOPE_ID,
  registerFinanzasMutationDefaults,
} from "@/modules/finanzas/offline/movimientos-offline"

const ONE_DAY = 1000 * 60 * 60 * 24
const ONE_WEEK = ONE_DAY * 7

// Se persiste solo lo que se marca explicitamente con meta.persist, no todo el cache:
// evita guardar respuestas grandes o de un solo uso que no aportan nada offline.
const shouldPersistQuery = (query: { meta?: Record<string, unknown> }) =>
  query.meta?.persist === true

// Solo sobreviven las colas diseñadas expresamente para reanudarse: el entreno activo y
// las altas idempotentes de movimientos. Ediciones y borrados siguen siendo online.
const shouldPersistMutation = (mutation: { options?: { scope?: { id?: string } } }) =>
  mutation.options?.scope?.id === ENTRENO_ACTIVO_SCOPE_ID ||
  mutation.options?.scope?.id === MOVIMIENTOS_OFFLINE_SCOPE_ID

const subscribeToClientSnapshot = () => () => {}
const getClientSnapshot = () => true
const getServerSnapshot = () => false

export function Providers({ children }: { children: React.ReactNode }) {
  const isClient = useSyncExternalStore(
    subscribeToClientSnapshot,
    getClientSnapshot,
    getServerSnapshot
  )
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 1000 * 30,
          // Las queries persistidas necesitan gcTime >= maxAge del persister: si se
          // recolectan antes, la siguiente escritura guarda un cache sin ellas y lo
          // restaurado se pierde solo.
          gcTime: ONE_WEEK,
          retry: 1,
          refetchOnWindowFocus: false,
          // Al recuperar la conexion se refresca lo que quedo servido desde el cache.
          refetchOnReconnect: true,
        },
        mutations: {
          retry: 0,
        },
      },
    })

    // Tiene que quedar registrado antes de que el persister rehidrate: al restaurar, la
    // mutacion guardada solo trae mutationKey y estado, y la funcion que la ejecuta sale
    // de estos defaults.
    registerEntrenamientosMutationDefaults(client)
    registerFinanzasMutationDefaults(client)

    return client
  })

  const persister = useMemo(() => (isClient ? createQueryPersister() : null), [isClient])

  useEffect(() => {
    if (isClient) {
      void requestPersistentStorage()
    }
  }, [isClient])

  if (!isClient || !persister) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: ONE_WEEK,
        // Cambiar de buster invalida lo guardado sin tener que limpiarlo a mano.
        buster: QUERY_CACHE_SCHEMA_VERSION,
        dehydrateOptions: {
          shouldDehydrateQuery: shouldPersistQuery,
          shouldDehydrateMutation: shouldPersistMutation,
        },
      }}
      onSuccess={() => {
        // Se corre despues de restaurar el cache: reenvia lo que quedo encolado sin red.
        void queryClient.resumePausedMutations()
      }}
    >
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </PersistQueryClientProvider>
  )
}
