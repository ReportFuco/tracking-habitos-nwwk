"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { clearStoredSession } from "@/lib/auth-session"
import { clearPersistedQueryCache } from "@/lib/query-persistence"
import { getFriendlyErrorMessage } from "@/lib/error-messages"
import { OFFLINE_ACTION_MESSAGE, isAppOffline } from "@/lib/online-only"
import { queryKeys } from "@/lib/query-keys"
import { AuthAPI } from "@/modules/auth/api/auth.api"
import { useProfile } from "@/modules/auth/hooks/useProfile"
import { AuthLoginPayload, AuthRegisterPayload } from "@/modules/auth/types/auth"
import { disableCurrentDeviceNotifications } from "@/modules/notifications/api/notifications.api"

export const useAuth = () => {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const profileQuery = useProfile()

  const loginMutation = useMutation({
    mutationFn: AuthAPI.login,
    onMutate: async () => {
      setError(null)
      clearStoredSession()
      await clearPersistedQueryCache()
      queryClient.removeQueries()
    },
    onSuccess: async () => {
      await queryClient.fetchQuery({
        queryKey: queryKeys.auth.profile,
        queryFn: async () => {
          const profile = await AuthAPI.getProfile()
          await AuthAPI.refreshSession()
          return profile
        },
        staleTime: 1000 * 60 * 5,
      })
    },
    onError: (err) => {
      setError(getFriendlyErrorMessage(err))
    },
  })

  const registerMutation = useMutation({
    mutationFn: AuthAPI.register,
    onMutate: () => {
      setError(null)
    },
    onError: (err) => {
      setError(getFriendlyErrorMessage(err))
    },
  })

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await disableCurrentDeviceNotifications()
      return AuthAPI.logout()
    },
    onSettled: async () => {
      clearStoredSession()
      queryClient.clear()
      await clearPersistedQueryCache()
    },
  })

  const login = async (payload: AuthLoginPayload) => {
    setError(null)

    // Sin red, mutateAsync quedaria pending/paused hasta reconectar (networkMode
    // "online" de TanStack). El login no tiene ni puede tener cola offline: depende de
    // credenciales frescas contra el backend.
    if (isAppOffline()) {
      setError(OFFLINE_ACTION_MESSAGE)
      return { ok: false as const, message: OFFLINE_ACTION_MESSAGE }
    }

    try {
      await loginMutation.mutateAsync(payload)
      return { ok: true as const }
    } catch (err) {
      const message = getFriendlyErrorMessage(err)
      setError(message)
      return { ok: false as const, message }
    }
  }

  const register = async (payload: AuthRegisterPayload) => {
    setError(null)

    // El alta de usuario requiere conexion: nunca hay que persistir la contraseña para
    // reintentar despues, asi que falla al instante en vez de encolarse.
    if (isAppOffline()) {
      setError(OFFLINE_ACTION_MESSAGE)
      return { ok: false as const, message: OFFLINE_ACTION_MESSAGE }
    }

    try {
      await registerMutation.mutateAsync(payload)
      return { ok: true as const }
    } catch (err) {
      const message = getFriendlyErrorMessage(err)
      setError(message)
      return { ok: false as const, message }
    }
  }

  const logout = async () => {
    // El logout local (limpiar sesion y cache) tiene que funcionar aunque no haya red;
    // solo se salta la revocacion server-side, que de todas formas es inalcanzable.
    if (isAppOffline()) {
      clearStoredSession()
      queryClient.clear()
      await clearPersistedQueryCache()
      return
    }

    try {
      await logoutMutation.mutateAsync()
    } catch {
      clearStoredSession()
      queryClient.clear()
      await clearPersistedQueryCache()
    }
  }

  return {
    profile: profileQuery.data ?? null,
    loadingProfile: profileQuery.isLoading || profileQuery.isFetching,
    submitting: loginMutation.isPending || registerMutation.isPending || logoutMutation.isPending,
    error,
    isAuthenticated: Boolean(profileQuery.data),
    fetchProfile: profileQuery.refetch,
    login,
    register,
    logout,
  }
}
