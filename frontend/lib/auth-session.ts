"use client"

export const AUTH_TOKEN_KEY = "auth_token"
export const LEGACY_TOKEN_KEY = "token"
export const QUERY_CACHE_STORAGE_KEY = "tcl-query-cache-v1"

const decodeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=")

  return atob(padded)
}

const parseJwtPayload = (token: string): Record<string, unknown> | null => {
  const [, payload] = token.split(".")

  if (!payload) {
    return null
  }

  try {
    return JSON.parse(decodeBase64Url(payload)) as Record<string, unknown>
  } catch {
    return null
  }
}

export const getStoredToken = () => {
  if (typeof window === "undefined") {
    return null
  }

  return localStorage.getItem(AUTH_TOKEN_KEY) ?? localStorage.getItem(LEGACY_TOKEN_KEY)
}

export const clearStoredSession = () => {
  if (typeof window === "undefined") {
    return
  }

  localStorage.removeItem(AUTH_TOKEN_KEY)
  localStorage.removeItem(LEGACY_TOKEN_KEY)
  localStorage.removeItem(QUERY_CACHE_STORAGE_KEY)
}

export const isStoredTokenLocallyValid = (token: string) => {
  const payload = parseJwtPayload(token)

  if (!payload) {
    return false
  }

  const exp = payload.exp

  if (typeof exp !== "number") {
    return false
  }

  return exp * 1000 > Date.now()
}

export const getValidStoredToken = () => {
  const token = getStoredToken()

  if (!token) {
    return null
  }

  if (!isStoredTokenLocallyValid(token)) {
    clearStoredSession()
    return null
  }

  return token
}
