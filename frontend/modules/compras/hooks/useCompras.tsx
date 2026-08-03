"use client"

import { createContext, ReactNode, useContext, useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { getFriendlyErrorMessage } from "@/lib/error-messages"
import { runOnlineOnlyAction } from "@/lib/online-only"
import { queryKeys } from "@/lib/query-keys"
import { ComprasAPI } from "@/modules/compras/api/compras.api"
import { CompraCreate, CompraPatch } from "@/modules/compras/types/compras"

const FIVE_MINUTES = 1000 * 60 * 5
const ONE_DAY = 1000 * 60 * 60 * 24
const ONE_WEEK = ONE_DAY * 7
const persistMeta = { persist: true }

type ComprasContextValue = ReturnType<typeof useComprasState>

const ComprasContext = createContext<ComprasContextValue | null>(null)

const useComprasState = () => {
  const queryClient = useQueryClient()

  const cadenasQuery = useQuery({
    queryKey: queryKeys.compras.cadenas,
    queryFn: ComprasAPI.getCadenas,
    staleTime: ONE_DAY,
    gcTime: ONE_WEEK,
    meta: persistMeta,
  })
  const localesQuery = useQuery({
    queryKey: queryKeys.compras.locales,
    queryFn: ComprasAPI.getLocales,
    staleTime: ONE_DAY,
    gcTime: ONE_WEEK,
    meta: persistMeta,
  })
  const comprasQuery = useQuery({
    queryKey: queryKeys.compras.compras,
    queryFn: ComprasAPI.getCompras,
    staleTime: FIVE_MINUTES,
    meta: persistMeta,
  })

  const invalidate = async (...keys: readonly (readonly unknown[])[]) => {
    await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
  }

  const compraCreateMutation = useMutation({
    mutationFn: ComprasAPI.createCompra,
    onSuccess: () => invalidate(queryKeys.compras.compras),
  })
  const compraUpdateMutation = useMutation({
    mutationFn: ({ idCompra, payload }: { idCompra: number; payload: CompraPatch }) =>
      ComprasAPI.updateCompra(idCompra, payload),
    onSuccess: () => invalidate(queryKeys.compras.compras),
  })
  const compraDeleteMutation = useMutation({
    mutationFn: ComprasAPI.deleteCompra,
    onSuccess: () => invalidate(queryKeys.compras.compras),
  })

  const error = cadenasQuery.error ?? localesQuery.error ?? comprasQuery.error ?? null

  return {
    cadenas: cadenasQuery.data ?? [],
    locales: localesQuery.data ?? [],
    compras: comprasQuery.data ?? [],
    loading: cadenasQuery.isLoading || localesQuery.isLoading || comprasQuery.isLoading,
    submitting:
      compraCreateMutation.isPending ||
      compraUpdateMutation.isPending ||
      compraDeleteMutation.isPending,
    error: error ? getFriendlyErrorMessage(error) : null,
    fetchResumen: () =>
      invalidate(queryKeys.compras.cadenas, queryKeys.compras.locales, queryKeys.compras.compras),
    crearCompra: (payload: CompraCreate) =>
      runOnlineOnlyAction(() => compraCreateMutation.mutateAsync(payload)),
    editarCompra: (idCompra: number, payload: CompraPatch) =>
      runOnlineOnlyAction(() => compraUpdateMutation.mutateAsync({ idCompra, payload })),
    eliminarCompra: (idCompra: number) =>
      runOnlineOnlyAction(() => compraDeleteMutation.mutateAsync(idCompra)),
  }
}

export function ComprasProvider({ children }: { children: ReactNode }) {
  const value = useComprasState()

  useEffect(() => {
    if (value.error) {
      toast.error("Error cargando compras", { description: value.error })
    }
  }, [value.error])

  return <ComprasContext.Provider value={value}>{children}</ComprasContext.Provider>
}

export const useCompras = () => {
  const ctx = useContext(ComprasContext)
  if (!ctx) throw new Error("useCompras debe usarse dentro de un ComprasProvider")
  return ctx
}
