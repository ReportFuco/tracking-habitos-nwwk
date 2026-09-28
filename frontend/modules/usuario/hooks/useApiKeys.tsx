"use client"

import { useCallback, useEffect, useState } from "react"
import { getFriendlyErrorMessage } from "@/lib/error-messages"
import { ApiKeysAPI } from "@/modules/usuario/api/api-keys.api"
import type { ApiKey, ApiKeyCreate } from "@/modules/usuario/schemas/api-key.schema"

// Sin React Query a proposito: el listado es chico, solo se ve en Perfil y no tiene
// sentido persistirlo en el cache offline junto a datos de credenciales.
export const useApiKeys = () => {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [revokingId, setRevokingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchKeys = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setKeys(await ApiKeysAPI.getAll())
    } catch (err) {
      setError(getFriendlyErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  const crearKey = async (payload: ApiKeyCreate) => {
    setCreating(true)
    try {
      const creada = await ApiKeysAPI.create(payload)
      const { api_key: secreto, ...key } = creada
      setKeys((prev) => [key, ...prev])
      return { ok: true as const, secreto }
    } catch (err) {
      return { ok: false as const, message: getFriendlyErrorMessage(err) }
    } finally {
      setCreating(false)
    }
  }

  const revocarKey = async (idApiKey: number) => {
    setRevokingId(idApiKey)
    try {
      await ApiKeysAPI.revoke(idApiKey)
      setKeys((prev) => prev.filter((key) => key.id_api_key !== idApiKey))
      return { ok: true as const }
    } catch (err) {
      return { ok: false as const, message: getFriendlyErrorMessage(err) }
    } finally {
      setRevokingId(null)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchKeys()
    }, 0)
    return () => clearTimeout(timer)
  }, [fetchKeys])

  return { keys, loading, creating, revokingId, error, crearKey, revocarKey }
}
