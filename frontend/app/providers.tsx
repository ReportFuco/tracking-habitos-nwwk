"use client"

import { useMemo, useState, useSyncExternalStore } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client"
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister"
import { QUERY_CACHE_STORAGE_KEY } from "@/lib/auth-session"

const ONE_DAY = 1000 * 60 * 60 * 24

const shouldPersistQuery = (query: { meta?: Record<string, unknown> }) =>
  query.meta?.persist === true

const subscribeToClientSnapshot = () => () => {}
const getClientSnapshot = () => true
const getServerSnapshot = () => false

export function Providers({ children }: { children: React.ReactNode }) {
  const isClient = useSyncExternalStore(
    subscribeToClientSnapshot,
    getClientSnapshot,
    getServerSnapshot
  )
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 30,
            gcTime: ONE_DAY,
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 0,
          },
        },
      })
  )

  const persister = useMemo(
    () =>
      isClient
        ? createSyncStoragePersister({
            storage: window.localStorage,
            key: QUERY_CACHE_STORAGE_KEY,
          })
        : null,
    [isClient]
  )

  if (!isClient || !persister) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: ONE_DAY * 7,
        dehydrateOptions: {
          shouldDehydrateQuery: shouldPersistQuery,
        },
      }}
    >
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </PersistQueryClientProvider>
  )
}
