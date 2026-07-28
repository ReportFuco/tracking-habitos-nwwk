"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { clearStoredSession, getValidStoredToken } from "@/lib/auth-session"
import { getFriendlyErrorMessage } from "@/lib/error-messages"
import { queryKeys } from "@/lib/query-keys"
import { AuthAPI } from "@/modules/auth/api/auth.api"
import { useProfile } from "@/modules/auth/hooks/useProfile"
import { AuthLoginPayload, AuthRegisterPayload } from "@/modules/auth/types/auth"

export const useAuth = () => {
  const queryClient = useQueryClient()
  const [token, setToken] = useState<string | null>(() => getValidStoredToken())
  const [error, setError] = useState<string | null>(null)
  const profileQuery = useProfile({ enabled: Boolean(token) })

  const loginMutation = useMutation({
    mutationFn: AuthAPI.login,
    onMutate: () => {
      setError(null)
    },
    onSuccess: async (data) => {
      queryClient.clear()
      localStorage.setItem("auth_token", data.access_token)
      setToken(data.access_token)
      await queryClient.fetchQuery({
        queryKey: queryKeys.auth.profile,
        queryFn: AuthAPI.getProfile,
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
    mutationFn: AuthAPI.logout,
    onSettled: () => {
      clearStoredSession()
      setToken(null)
      queryClient.clear()
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
      setToken(null)
      queryClient.clear()
    }
  }

  return {
    token,
    profile: profileQuery.data ?? null,
    loadingProfile: profileQuery.isLoading || profileQuery.isFetching,
    submitting: loginMutation.isPending || registerMutation.isPending || logoutMutation.isPending,
    error,
    isAuthenticated: Boolean(token),
    fetchProfile: profileQuery.refetch,
    login,
    register,
    logout,
  }
}
