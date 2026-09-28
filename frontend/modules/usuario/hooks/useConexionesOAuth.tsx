"use client"

import { useCallback, useEffect, useState } from "react"
import { getFriendlyErrorMessage } from "@/lib/error-messages"
import { OAuthAPI } from "@/modules/usuario/api/oauth.api"
import type { ConexionOAuth } from "@/modules/usuario/schemas/oauth.schema"

// Apps conectadas por OAuth (Claude.ai, ChatGPT...). Mismo criterio que useApiKeys: sin
// React Query para no persistir datos de credenciales en el cache offline.
export const useConexionesOAuth = () => {
  const [conexiones, setConexiones] = useState<ConexionOAuth[]>([])
  const [loading, setLoading] = useState(false)
  const [revokingId, setRevokingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchConexiones = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setConexiones(await OAuthAPI.getConexiones())
    } catch (err) {
      setError(getFriendlyErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  const revocarConexion = async (idAutorizacion: number) => {
    setRevokingId(idAutorizacion)
    try {
      await OAuthAPI.revocar(idAutorizacion)
      setConexiones((prev) => prev.filter((c) => c.id_autorizacion !== idAutorizacion))
      return { ok: true as const }
    } catch (err) {
      return { ok: false as const, message: getFriendlyErrorMessage(err) }
    } finally {
      setRevokingId(null)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchConexiones()
    }, 0)
    return () => clearTimeout(timer)
  }, [fetchConexiones])

  return { conexiones, loading, revokingId, error, revocarConexion }
}
