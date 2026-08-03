"use client"

import { createContext, ReactNode, useContext, useMemo } from "react"
import {
  onlineManager,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { toast } from "sonner"
import { getFriendlyErrorMessage } from "@/lib/error-messages"
import { runOnlineOnlyAction } from "@/lib/online-only"
import { queryKeys } from "@/lib/query-keys"
import { FinanzasAPI } from "@/modules/finanzas/api/finanzas.api"
import { finanzasMutationKeys } from "@/modules/finanzas/offline/movimientos-offline"
import {
  BancoCreate,
  CategoriaCreate,
  CategoriaPatch,
  CuentaCreate,
  CuentaPatch,
  MovimientoCreate,
  MovimientoPatch,
  MovimientoResponse,
  ProductoFinancieroResponse,
} from "@/modules/finanzas/types/finanzas"

const MOVIMIENTOS_LIMIT = 20
const ONE_MINUTE = 1000 * 60
const FIVE_MINUTES = ONE_MINUTE * 5
const ONE_DAY = ONE_MINUTE * 60 * 24
const ONE_WEEK = ONE_DAY * 7

type FinanzasContextValue = ReturnType<typeof useFinanzasState>
type ActionResult = Promise<
  { ok: true; queued?: boolean } | { ok: false; message: string }
>

const FinanzasContext = createContext<FinanzasContextValue | null>(null)
const persistMeta = { persist: true }

export function useAnaliticaResumen(params?: { year?: number; month?: number }) {
  return useQuery({
    queryKey: queryKeys.finanzas.analiticaResumen(params),
    queryFn: () => FinanzasAPI.getAnaliticaResumen(params),
    staleTime: FIVE_MINUTES,
  })
}

const useFinanzasState = () => {
  const queryClient = useQueryClient()

  const bancosQuery = useQuery({
    queryKey: queryKeys.finanzas.bancos,
    queryFn: FinanzasAPI.getBancos,
    staleTime: ONE_DAY,
    gcTime: ONE_WEEK,
    meta: persistMeta,
  })
  const categoriasQuery = useQuery({
    queryKey: queryKeys.finanzas.categorias,
    queryFn: FinanzasAPI.getCategorias,
    staleTime: ONE_DAY,
    gcTime: ONE_WEEK,
    meta: persistMeta,
  })
  const cuentasQuery = useQuery({
    queryKey: queryKeys.finanzas.cuentas,
    queryFn: FinanzasAPI.getCuentas,
    staleTime: FIVE_MINUTES,
    meta: persistMeta,
  })
  const movimientosQuery = useInfiniteQuery({
    queryKey: queryKeys.finanzas.movimientos,
    queryFn: ({ pageParam }) =>
      FinanzasAPI.getMovimientos({ offset: pageParam, limit: MOVIMIENTOS_LIMIT }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.items.length === MOVIMIENTOS_LIMIT
        ? lastPage.offset + lastPage.items.length
        : undefined,
    staleTime: ONE_MINUTE,
    // Se persisten todas las paginas ya cargadas, no solo la primera: al volver sin red
    // el historico se ve igual que como quedo.
    meta: persistMeta,
  })

  const bancos = bancosQuery.data ?? []
  const categorias = categoriasQuery.data ?? []
  const cuentas = cuentasQuery.data ?? []
  const movimientos = useMemo(
    () => movimientosQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [movimientosQuery.data]
  )
  const totalGastoMensual = movimientosQuery.data?.pages.at(-1)?.total_gasto_mensual ?? 0

  const invalidateFinanzas = async (...keys: readonly (readonly unknown[])[]) => {
    await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
  }

  const bancoCreateMutation = useMutation({
    mutationFn: FinanzasAPI.createBanco,
    onSuccess: () =>
      invalidateFinanzas(queryKeys.finanzas.bancos, queryKeys.finanzas.productosRoot),
  })
  const bancoUpdateMutation = useMutation({
    mutationFn: ({ idBanco, payload }: { idBanco: number; payload: BancoCreate }) =>
      FinanzasAPI.updateBanco(idBanco, payload),
    onSuccess: () =>
      invalidateFinanzas(queryKeys.finanzas.bancos, queryKeys.finanzas.productosRoot),
  })
  const bancoDeleteMutation = useMutation({
    mutationFn: FinanzasAPI.deleteBanco,
    onSuccess: () =>
      invalidateFinanzas(queryKeys.finanzas.bancos, queryKeys.finanzas.productosRoot),
  })

  const categoriaCreateMutation = useMutation({
    mutationFn: FinanzasAPI.createCategoria,
    onSuccess: () => invalidateFinanzas(queryKeys.finanzas.categorias),
  })
  const categoriaUpdateMutation = useMutation({
    mutationFn: ({ idCategoria, payload }: { idCategoria: number; payload: CategoriaPatch }) =>
      FinanzasAPI.updateCategoria(idCategoria, payload),
    onSuccess: () => invalidateFinanzas(queryKeys.finanzas.categorias),
  })
  const categoriaDeleteMutation = useMutation({
    mutationFn: FinanzasAPI.deleteCategoria,
    onSuccess: () => invalidateFinanzas(queryKeys.finanzas.categorias),
  })

  const cuentaCreateMutation = useMutation({
    mutationFn: FinanzasAPI.createCuenta,
    onSuccess: () => invalidateFinanzas(queryKeys.finanzas.cuentas),
  })
  const cuentaUpdateMutation = useMutation({
    mutationFn: ({ idCuenta, payload }: { idCuenta: number; payload: CuentaPatch }) =>
      FinanzasAPI.updateCuenta(idCuenta, payload),
    onSuccess: () => invalidateFinanzas(queryKeys.finanzas.cuentas),
  })
  const cuentaDeleteMutation = useMutation({
    mutationFn: FinanzasAPI.deleteCuenta,
    onSuccess: () => invalidateFinanzas(queryKeys.finanzas.cuentas),
  })

  // La funcion y los callbacks viven en los defaults globales para que TanStack pueda
  // reconstruir esta mutacion despues de cerrar o recargar la PWA.
  const movimientoCreateMutation = useMutation<
    MovimientoResponse,
    Error,
    MovimientoCreate
  >({
    mutationKey: finanzasMutationKeys.movimientoCreate,
  })
  const movimientoUpdateMutation = useMutation({
    mutationFn: ({
      idMovimiento,
      payload,
    }: {
      idMovimiento: number
      payload: MovimientoPatch
    }) => FinanzasAPI.updateMovimiento(idMovimiento, payload),
    onSuccess: () => invalidateFinanzas(queryKeys.finanzas.movimientos, queryKeys.finanzas.analitica),
  })

  const fetchCatalogos = async () => {
    await invalidateFinanzas(
      queryKeys.finanzas.bancos,
      queryKeys.finanzas.categorias,
      queryKeys.finanzas.cuentas,
      queryKeys.finanzas.movimientos
    )
  }

  const loadMoreMovimientos = async () => {
    try {
      await movimientosQuery.fetchNextPage()
    } catch (err) {
      toast.error("No se pudieron cargar más movimientos", {
        description: getFriendlyErrorMessage(err),
      })
    }
  }

  const getProductosByBanco = async (idBanco: number): Promise<ProductoFinancieroResponse[]> => {
    try {
      return await queryClient.fetchQuery({
        queryKey: queryKeys.finanzas.productos(idBanco),
        queryFn: () => FinanzasAPI.getProductosFinancieros({ id_banco: idBanco }),
        staleTime: ONE_DAY,
        gcTime: ONE_WEEK,
      })
    } catch (err) {
      toast.error("No pudimos cargar los productos del banco", {
        description: getFriendlyErrorMessage(err),
      })
      return []
    }
  }

  const error =
    bancosQuery.error ??
    categoriasQuery.error ??
    cuentasQuery.error ??
    movimientosQuery.error ??
    null

  return {
    bancos,
    categorias,
    cuentas,
    movimientos,
    totalGastoMensual,
    hasMoreMovimientos: Boolean(movimientosQuery.hasNextPage),
    loadingMoreMovimientos: movimientosQuery.isFetchingNextPage,
    loadingCatalogos:
      bancosQuery.isLoading ||
      categoriasQuery.isLoading ||
      cuentasQuery.isLoading ||
      movimientosQuery.isLoading,
    submittingCuenta:
      cuentaCreateMutation.isPending ||
      cuentaUpdateMutation.isPending ||
      cuentaDeleteMutation.isPending,
    submittingMovimiento:
      (movimientoCreateMutation.isPending && !movimientoCreateMutation.isPaused) ||
      movimientoUpdateMutation.isPending,
    error: error ? getFriendlyErrorMessage(error) : null,
    fetchCatalogos,
    loadMoreMovimientos,
    crearBanco: (payload: BancoCreate) => runOnlineOnlyAction(() => bancoCreateMutation.mutateAsync(payload)),
    editarBanco: (idBanco: number, payload: BancoCreate) =>
      runOnlineOnlyAction(() => bancoUpdateMutation.mutateAsync({ idBanco, payload })),
    eliminarBanco: (idBanco: number) => runOnlineOnlyAction(() => bancoDeleteMutation.mutateAsync(idBanco)),
    crearCategoria: (payload: CategoriaCreate) =>
      runOnlineOnlyAction(() => categoriaCreateMutation.mutateAsync(payload)),
    editarCategoria: (idCategoria: number, payload: CategoriaPatch) =>
      runOnlineOnlyAction(() => categoriaUpdateMutation.mutateAsync({ idCategoria, payload })),
    eliminarCategoria: (idCategoria: number) =>
      runOnlineOnlyAction(() => categoriaDeleteMutation.mutateAsync(idCategoria)),
    crearCuenta: (payload: CuentaCreate) => runOnlineOnlyAction(() => cuentaCreateMutation.mutateAsync(payload)),
    editarCuenta: (idCuenta: number, payload: CuentaPatch) =>
      runOnlineOnlyAction(() => cuentaUpdateMutation.mutateAsync({ idCuenta, payload })),
    eliminarCuenta: (idCuenta: number) => runOnlineOnlyAction(() => cuentaDeleteMutation.mutateAsync(idCuenta)),
    crearMovimiento: async (payload: MovimientoCreate): ActionResult => {
      if (!onlineManager.isOnline()) {
        movimientoCreateMutation.mutate(payload)
        return { ok: true, queued: true }
      }

      return runOnlineOnlyAction(() => movimientoCreateMutation.mutateAsync(payload))
    },
    editarMovimiento: (idMovimiento: number, payload: MovimientoPatch) =>
      runOnlineOnlyAction(() => movimientoUpdateMutation.mutateAsync({ idMovimiento, payload })),
    getProductosByBanco,
  }
}

export function FinanzasProvider({ children }: { children: ReactNode }) {
  const value = useFinanzasState()
  return <FinanzasContext.Provider value={value}>{children}</FinanzasContext.Provider>
}

export const useFinanzas = () => {
  const context = useContext(FinanzasContext)
  if (!context) throw new Error("useFinanzas debe usarse dentro de un FinanzasProvider")
  return context
}
