"use client"

import { useCallback, useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { getFriendlyErrorMessage } from "@/lib/error-messages"
import { queryKeys } from "@/lib/query-keys"
import { UsuariosAPI } from "@/modules/usuario/api/usuario.api"
import { Usuario, UsuarioPerfilPatch } from "@/modules/usuario/types/usuario"

export const usePerfil = () => {
  const queryClient = useQueryClient()
  const [perfil, setPerfil] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPerfil = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await UsuariosAPI.getPerfil()
      setPerfil(data)
    } catch (err) {
      setError(getFriendlyErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  const actualizarPerfil = async (payload: UsuarioPerfilPatch) => {
    setSubmitting(true)
    setError(null)
    try {
      const data = await UsuariosAPI.updatePerfil(payload)
      setPerfil(data)
      // La topbar y la portada de Perfil leen el perfil de la sesion.
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.profile })
      return { ok: true as const, perfil: data }
    } catch (err) {
      const message = getFriendlyErrorMessage(err)
      setError(message)
      return { ok: false as const, message }
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchPerfil()
    }, 0)
    return () => clearTimeout(timer)
  }, [fetchPerfil])

  return {
    perfil,
    loading,
    submitting,
    error,
    refetch: fetchPerfil,
    actualizarPerfil,
  }
}
