"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { AuthAPI } from "@/modules/auth/api/auth.api"

export function useProfile(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.auth.profile,
    queryFn: async () => {
      const profile = await AuthAPI.getProfile()

      // La sesión se extiende solo después de comprobar que el usuario sigue activo.
      // Un JWT bearer legado puede cargar el perfil aunque no tenga cookie.
      await AuthAPI.refreshSession().catch(() => undefined)

      return profile
    },
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60 * 5,
    // Tiene que ser >= al maxAge del persister (7 dias). Con un gcTime mas corto la
    // query se recolecta al quedar sin observadores y la siguiente escritura del
    // persister guarda un cache sin el perfil, con lo que el arranque offline deja de
    // encontrarlo. Ver app/providers.tsx.
    gcTime: 1000 * 60 * 60 * 24 * 7,
    retry: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    meta: { persist: true },
  })
}
