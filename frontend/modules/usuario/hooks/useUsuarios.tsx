"use client"

import { useCallback, useEffect, useState } from "react"
import { getFriendlyErrorMessage } from "@/lib/error-messages"
import { UsuariosAPI } from "@/modules/usuario/api/usuario.api"
import { Usuario } from "@/modules/usuario/types/usuario"

export const useUsuarios = () => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchUsuarios = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await UsuariosAPI.getAll()
      setUsuarios(data)
    } catch (err) {
      setError(getFriendlyErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  const desactivar = async (idUsuario: number) => {
    setSubmitting(true)
    setError(null)
    try {
      await UsuariosAPI.desactivar(idUsuario)
      await fetchUsuarios()
      return { ok: true as const }
    } catch (err) {
      const message = getFriendlyErrorMessage(err)
      setError(message)
      return { ok: false as const, message }
    } finally {
      setSubmitting(false)
    }
  }

  const eliminarPermanente = async (idUsuario: number) => {
    setSubmitting(true)
    setError(null)
    try {
      await UsuariosAPI.eliminarPermanente(idUsuario)
      await fetchUsuarios()
      return { ok: true as const }
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
      void fetchUsuarios()
    }, 0)
    return () => clearTimeout(timer)
  }, [fetchUsuarios])

  return {
    usuarios,
    loading,
    submitting,
    error,
    refetch: fetchUsuarios,
    desactivar,
    eliminarPermanente,
  }
}
