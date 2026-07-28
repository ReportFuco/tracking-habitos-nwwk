"use client"

import { useQuery } from "@tanstack/react-query"
import { getValidStoredToken } from "@/lib/auth-session"
import { queryKeys } from "@/lib/query-keys"
import { AuthAPI } from "@/modules/auth/api/auth.api"

export function useProfile(options?: { enabled?: boolean }) {
  const token = getValidStoredToken()

  return useQuery({
    queryKey: queryKeys.auth.profile,
    queryFn: AuthAPI.getProfile,
    enabled: Boolean(token) && (options?.enabled ?? true),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  })
}
