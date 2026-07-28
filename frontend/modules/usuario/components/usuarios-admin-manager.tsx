"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { FormPanel } from "@/components/forms/editorial-form"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { UsuariosAPI } from "@/modules/usuario/api/usuario.api"
import type { Usuario } from "@/modules/usuario/types/usuario"

export function UsuariosAdminManager() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<number | null>(null)

  useEffect(() => {
    void UsuariosAPI.getAll()
      .then(setUsuarios)
      .catch(() => toast.error("Error al cargar usuarios"))
      .finally(() => setLoading(false))
  }, [])

  const handleDesactivar = async (idUsuario: number) => {
    setSubmitting(idUsuario)
    try {
      await UsuariosAPI.desactivar(idUsuario)
      setUsuarios((prev) => prev.map((u) => (u.id_usuario === idUsuario ? { ...u, is_active: false } : u)))
      toast.success("Usuario desactivado")
    } catch {
      toast.error("No se pudo desactivar el usuario")
    } finally {
      setSubmitting(null)
    }
  }

  const handleEliminar = async (idUsuario: number) => {
    setSubmitting(idUsuario)
    try {
      await UsuariosAPI.eliminarPermanente(idUsuario)
      setUsuarios((prev) => prev.filter((u) => u.id_usuario !== idUsuario))
      toast.success("Usuario eliminado permanentemente")
    } catch {
      toast.error("No se pudo eliminar el usuario")
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <FormPanel eyebrow="Sistema">
      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando usuarios...</p>
      ) : usuarios.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay usuarios registrados.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-36 text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuarios.map((usuario) => {
              const isBusy = submitting === usuario.id_usuario
              return (
                <TableRow key={usuario.id_usuario}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{usuario.nombre} {usuario.apellido}</span>
                      {usuario.is_superuser ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          Admin
                        </span>
                      ) : null}
                      {!usuario.is_active ? (
                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                          Inactivo
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground">@{usuario.username}</div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{usuario.email}</TableCell>
                  <TableCell>
                    {!usuario.is_superuser ? (
                      <div className="flex justify-end gap-1">
                        {usuario.is_active ? (
                          <Button
                            size="sm" variant="ghost"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() => handleDesactivar(usuario.id_usuario)}
                            disabled={isBusy}
                          >
                            Desactivar
                          </Button>
                        ) : null}
                        <Button
                          size="sm" variant="ghost"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => handleEliminar(usuario.id_usuario)}
                          disabled={isBusy}
                        >
                          Eliminar
                        </Button>
                      </div>
                    ) : null}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </FormPanel>
  )
}
