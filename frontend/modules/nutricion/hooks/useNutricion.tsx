"use client"

import { createContext, ReactNode, useContext, useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { getFriendlyErrorMessage } from "@/lib/error-messages"
import { runOnlineOnlyAction } from "@/lib/online-only"
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
    meta: persistMeta,
  })
  const metasQuery = useQuery({
    queryKey: queryKeys.nutricion.metas,
    queryFn: NutricionAPI.getMetas,
    staleTime: FIVE_MINUTES,
    meta: persistMeta,
  })
  const pesosQuery = useQuery({
    queryKey: queryKeys.nutricion.pesos,
    queryFn: NutricionAPI.getPesos,
    staleTime: FIVE_MINUTES,
    meta: persistMeta,
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
      runOnlineOnlyAction(() => consumoCreateMutation.mutateAsync(payload)),
    editarConsumo: (idConsumo: number, payload: ConsumoPatch) =>
      runOnlineOnlyAction(() => consumoUpdateMutation.mutateAsync({ idConsumo, payload })),
    eliminarConsumo: (idConsumo: number) =>
      runOnlineOnlyAction(() => consumoDeleteMutation.mutateAsync(idConsumo)),
    crearConsumoDetalle: (payload: ConsumoDetalleCreate) =>
      runOnlineOnlyAction(() => consumoDetalleCreateMutation.mutateAsync(payload)),
    editarConsumoDetalle: (idDetalle: number, payload: ConsumoDetallePatch) =>
      runOnlineOnlyAction(() => consumoDetalleUpdateMutation.mutateAsync({ idDetalle, payload })),
    eliminarConsumoDetalle: (idDetalle: number) =>
      runOnlineOnlyAction(() => consumoDetalleDeleteMutation.mutateAsync(idDetalle)),
    crearMeta: (payload: MetaNutricionalCreate) =>
      runOnlineOnlyAction(() => metaCreateMutation.mutateAsync(payload)),
    editarMeta: (idMeta: number, payload: MetaNutricionalPatch) =>
      runOnlineOnlyAction(() => metaUpdateMutation.mutateAsync({ idMeta, payload })),
    eliminarMeta: (idMeta: number) => runOnlineOnlyAction(() => metaDeleteMutation.mutateAsync(idMeta)),
    crearPeso: (payload: PesoCreate) => runOnlineOnlyAction(() => pesoCreateMutation.mutateAsync(payload)),
    editarPeso: (idPeso: number, payload: PesoPatch) =>
      runOnlineOnlyAction(() => pesoUpdateMutation.mutateAsync({ idPeso, payload })),
    eliminarPeso: (idPeso: number) => runOnlineOnlyAction(() => pesoDeleteMutation.mutateAsync(idPeso)),
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
