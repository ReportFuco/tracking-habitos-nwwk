"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { clearStoredSession } from "@/lib/auth-session"
import { clearPersistedQueryCache } from "@/lib/query-persistence"
import { getFriendlyErrorMessage } from "@/lib/error-messages"
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
