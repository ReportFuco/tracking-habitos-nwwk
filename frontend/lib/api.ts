import axios from "axios"
import { clearStoredSession, getValidStoredToken } from "@/lib/auth-session"
import { clearPersistedQueryCache } from "@/lib/query-persistence"

declare module "axios" {
  export interface AxiosRequestConfig {
    skipAuthRedirect?: boolean
  }
}

const configuredBaseURL =
  process.env.NEXT_PUBLIC_API_URL?.trim() ||
  (process.env.NODE_ENV === "development" ? "http://localhost:8000" : "")
const LOGIN_PATH = "/login"
// Pantallas publicas: consultan el perfil para saber si ya hay sesion, y el 401 de un
// visitante sin cuenta no puede mandarlo a login (registro quedaria inalcanzable).
const PUBLIC_AUTH_PATHS = new Set([LOGIN_PATH, "/register"])
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"])

// En desarrollo la app se abre indistintamente desde localhost o desde la IP de la
// tailnet (ver allowedDevOrigins en next.config.ts). Si la URL configurada apunta al
// loopback pero la pagina se sirvio desde otro host, ese loopback es el del equipo que
// navega y no el del backend, asi que se reapunta al mismo host de la pagina.
const resolveBaseURL = () => {
  if (typeof window === "undefined") {
    return configuredBaseURL
  }

  try {
    const target = new URL(configuredBaseURL)

    if (LOOPBACK_HOSTS.has(target.hostname) && !LOOPBACK_HOSTS.has(window.location.hostname)) {
      target.hostname = window.location.hostname
      return target.origin
    }
  } catch {
    return configuredBaseURL
  }

  return configuredBaseURL
}

const baseURL = resolveBaseURL()

let isHandlingUnauthorized = false

export const api = axios.create({
  baseURL,
  timeout: 15000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
})

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = getValidStoredToken()

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window === "undefined") {
      return Promise.reject(error)
    }

    const skipAuthRedirect = Boolean(error?.config?.skipAuthRedirect)
    const isPublicAuthPage = PUBLIC_AUTH_PATHS.has(window.location.pathname)

    if (
      error?.response?.status === 401 &&
      !skipAuthRedirect &&
      !isPublicAuthPage &&
      !isHandlingUnauthorized
    ) {
      isHandlingUnauthorized = true

      clearStoredSession()

      const currentPath = `${window.location.pathname}${window.location.search}`
      const nextParam = `?next=${encodeURIComponent(currentPath)}`

      // Se espera a borrar el cache persistido: si la navegacion gana, login lo restaura con
      // el perfil de la sesion muerta.
      void clearPersistedQueryCache().finally(() => window.location.replace(`${LOGIN_PATH}${nextParam}`))
    }

    return Promise.reject(error)
  },
)
