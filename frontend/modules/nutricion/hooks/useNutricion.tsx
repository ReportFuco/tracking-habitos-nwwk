"use client"

import { createContext, ReactNode, useContext, useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { getFriendlyErrorMessage } from "@/lib/error-messages"
import { queryKeys } from "@/lib/query-keys"
import { NutricionAPI } from "@/modules/nutricion/api/nutricion.api"
import {
  ConsumoCreate,
  ConsumoDetalleCreate,
  ConsumoDetallePatch,
  ConsumoPatch,
  MetaNutricionalCreate,
  MetaNutricionalPatch,
  PesoCreate,
  PesoPatch,
} from "@/modules/nutricion/types/nutricion"

const FIVE_MINUTES = 1000 * 60 * 5
const ONE_DAY = 1000 * 60 * 60 * 24
const ONE_WEEK = ONE_DAY * 7
const persistMeta = { persist: true }

type NutricionContextValue = ReturnType<typeof useNutricionState>

const NutricionContext = createContext<NutricionContextValue | null>(null)

const useNutricionState = () => {
  const queryClient = useQueryClient()

  const consumosQuery = useQuery({
    queryKey: queryKeys.nutricion.consumos,
    queryFn: NutricionAPI.getConsumos,
    staleTime: FIVE_MINUTES,
  })
  const metasQuery = useQuery({
    queryKey: queryKeys.nutricion.metas,
    queryFn: NutricionAPI.getMetas,
    staleTime: FIVE_MINUTES,
  })
  const pesosQuery = useQuery({
    queryKey: queryKeys.nutricion.pesos,
    queryFn: NutricionAPI.getPesos,
    staleTime: FIVE_MINUTES,
  })
  const tablasQuery = useQuery({
    queryKey: queryKeys.nutricion.tablas,
    queryFn: NutricionAPI.getTablas,
    staleTime: ONE_DAY,
    gcTime: ONE_WEEK,
    meta: persistMeta,
  })

  const invalidate = async (...keys: readonly (readonly unknown[])[]) => {
    await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
  }

  const runAction = async <T,>(action: () => Promise<T>) => {
    try {
      await action()
      return { ok: true as const }
    } catch (err) {
      const message = getFriendlyErrorMessage(err)
      return { ok: false as const, message }
    }
  }

  const consumoCreateMutation = useMutation({
    mutationFn: NutricionAPI.createConsumo,
    onSuccess: () => invalidate(queryKeys.nutricion.consumos),
  })
  const consumoUpdateMutation = useMutation({
    mutationFn: ({ idConsumo, payload }: { idConsumo: number; payload: ConsumoPatch }) =>
      NutricionAPI.updateConsumo(idConsumo, payload),
    onSuccess: () => invalidate(queryKeys.nutricion.consumos),
  })
  const consumoDeleteMutation = useMutation({
    mutationFn: NutricionAPI.deleteConsumo,
    onSuccess: () => invalidate(queryKeys.nutricion.consumos),
  })
  const consumoDetalleCreateMutation = useMutation({
    mutationFn: NutricionAPI.createConsumoDetalle,
    onSuccess: () => invalidate(queryKeys.nutricion.consumos),
  })
  const consumoDetalleUpdateMutation = useMutation({
    mutationFn: ({ idDetalle, payload }: { idDetalle: number; payload: ConsumoDetallePatch }) =>
      NutricionAPI.updateConsumoDetalle(idDetalle, payload),
    onSuccess: () => invalidate(queryKeys.nutricion.consumos),
  })
  const consumoDetalleDeleteMutation = useMutation({
    mutationFn: NutricionAPI.deleteConsumoDetalle,
    onSuccess: () => invalidate(queryKeys.nutricion.consumos),
  })
  const metaCreateMutation = useMutation({
    mutationFn: NutricionAPI.createMeta,
    onSuccess: () => invalidate(queryKeys.nutricion.metas),
  })
  const metaUpdateMutation = useMutation({
    mutationFn: ({ idMeta, payload }: { idMeta: number; payload: MetaNutricionalPatch }) =>
      NutricionAPI.updateMeta(idMeta, payload),
    onSuccess: () => invalidate(queryKeys.nutricion.metas),
  })
  const metaDeleteMutation = useMutation({
    mutationFn: NutricionAPI.deleteMeta,
    onSuccess: () => invalidate(queryKeys.nutricion.metas),
  })
  const pesoCreateMutation = useMutation({
    mutationFn: NutricionAPI.createPeso,
    onSuccess: () => invalidate(queryKeys.nutricion.pesos),
  })
  const pesoUpdateMutation = useMutation({
    mutationFn: ({ idPeso, payload }: { idPeso: number; payload: PesoPatch }) =>
      NutricionAPI.updatePeso(idPeso, payload),
    onSuccess: () => invalidate(queryKeys.nutricion.pesos),
  })
  const pesoDeleteMutation = useMutation({
    mutationFn: NutricionAPI.deletePeso,
    onSuccess: () => invalidate(queryKeys.nutricion.pesos),
  })

  const error =
    consumosQuery.error ?? metasQuery.error ?? pesosQuery.error ?? tablasQuery.error ?? null

  return {
    consumos: consumosQuery.data ?? [],
    metas: metasQuery.data ?? [],
    pesos: pesosQuery.data ?? [],
    tablas: tablasQuery.data ?? [],
    loading:
      consumosQuery.isLoading ||
      metasQuery.isLoading ||
      pesosQuery.isLoading ||
      tablasQuery.isLoading,
    submitting:
      consumoCreateMutation.isPending ||
      consumoUpdateMutation.isPending ||
      consumoDeleteMutation.isPending ||
      consumoDetalleCreateMutation.isPending ||
      consumoDetalleUpdateMutation.isPending ||
      consumoDetalleDeleteMutation.isPending ||
      metaCreateMutation.isPending ||
      metaUpdateMutation.isPending ||
      metaDeleteMutation.isPending ||
      pesoCreateMutation.isPending ||
      pesoUpdateMutation.isPending ||
      pesoDeleteMutation.isPending,
    error: error ? getFriendlyErrorMessage(error) : null,
    fetchResumen: () =>
      invalidate(
        queryKeys.nutricion.consumos,
        queryKeys.nutricion.metas,
        queryKeys.nutricion.pesos,
        queryKeys.nutricion.tablas
      ),
    crearConsumo: (payload: ConsumoCreate) =>
      runAction(() => consumoCreateMutation.mutateAsync(payload)),
    editarConsumo: (idConsumo: number, payload: ConsumoPatch) =>
      runAction(() => consumoUpdateMutation.mutateAsync({ idConsumo, payload })),
    eliminarConsumo: (idConsumo: number) =>
      runAction(() => consumoDeleteMutation.mutateAsync(idConsumo)),
    crearConsumoDetalle: (payload: ConsumoDetalleCreate) =>
      runAction(() => consumoDetalleCreateMutation.mutateAsync(payload)),
    editarConsumoDetalle: (idDetalle: number, payload: ConsumoDetallePatch) =>
      runAction(() => consumoDetalleUpdateMutation.mutateAsync({ idDetalle, payload })),
    eliminarConsumoDetalle: (idDetalle: number) =>
      runAction(() => consumoDetalleDeleteMutation.mutateAsync(idDetalle)),
    crearMeta: (payload: MetaNutricionalCreate) =>
      runAction(() => metaCreateMutation.mutateAsync(payload)),
    editarMeta: (idMeta: number, payload: MetaNutricionalPatch) =>
      runAction(() => metaUpdateMutation.mutateAsync({ idMeta, payload })),
    eliminarMeta: (idMeta: number) => runAction(() => metaDeleteMutation.mutateAsync(idMeta)),
    crearPeso: (payload: PesoCreate) => runAction(() => pesoCreateMutation.mutateAsync(payload)),
    editarPeso: (idPeso: number, payload: PesoPatch) =>
      runAction(() => pesoUpdateMutation.mutateAsync({ idPeso, payload })),
    eliminarPeso: (idPeso: number) => runAction(() => pesoDeleteMutation.mutateAsync(idPeso)),
  }
}

export function NutricionProvider({ children }: { children: ReactNode }) {
  const value = useNutricionState()

  useEffect(() => {
    if (value.error) {
      toast.error("Error cargando nutricion", { description: value.error })
    }
  }, [value.error])

  return <NutricionContext.Provider value={value}>{children}</NutricionContext.Provider>
}

export const useNutricion = () => {
  const ctx = useContext(NutricionContext)
  if (!ctx) throw new Error("useNutricion debe usarse dentro de un NutricionProvider")
  return ctx
}
