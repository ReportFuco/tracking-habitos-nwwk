"use client"

import { FormEvent, useState } from "react"
import { Archive, ArchiveRestore, Check, Pencil, Plus, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useCategoriasTodas, useFinanzas } from "@/modules/finanzas/hooks/useFinanzas"
import type { CategoriaResponse } from "@/modules/finanzas/types/finanzas"

const inputClass =
  "h-11 w-full min-w-0 rounded-md border border-border bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground"
const tituloClass = "text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"

/**
 * Categorias del usuario: crea las suyas, las renombra y las archiva. Las por defecto se
 * muestran como referencia (las administra un administrador).
 */
export function MisCategorias() {
  const { crearCategoria, editarCategoria, eliminarCategoria } = useFinanzas()
  const todasQuery = useCategoriasTodas()
  const [nombre, setNombre] = useState("")
  const [creando, setCreando] = useState(false)

  const todas = todasQuery.data ?? []
  const porDefecto = todas.filter((categoria) => !categoria.es_propia && categoria.activo)
  const propias = todas.filter((categoria) => categoria.es_propia && categoria.activo)
  const archivadas = todas.filter((categoria) => categoria.es_propia && !categoria.activo)

  const crear = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!nombre.trim()) return
    setCreando(true)
    const result = await crearCategoria({ nombre: nombre.trim() })
    setCreando(false)
    if (!result.ok) {
      toast.error("No pudimos crear la categoria", { description: result.message })
      return
    }
    toast.success(`Categoria «${result.categoria.nombre}» creada`)
    setNombre("")
  }

  const archivar = async (categoria: CategoriaResponse) => {
    const result = await eliminarCategoria(categoria.id_categoria)
    if (!result.ok) {
      toast.error("No pudimos quitar la categoria", { description: result.message })
      return
    }
    // El backend borra la que nunca se uso y archiva la que tiene movimientos.
    const { data: actualizadas = [] } = await todasQuery.refetch()
    const sigue = actualizadas.some((item) => item.id_categoria === categoria.id_categoria)
    toast.success(sigue ? `«${categoria.nombre}» archivada: sus movimientos la conservan` : `«${categoria.nombre}» eliminada`)
  }

  const restaurar = async (categoria: CategoriaResponse) => {
    const result = await editarCategoria(categoria.id_categoria, { activo: true })
    if (!result.ok) toast.error("No pudimos restaurar la categoria", { description: result.message })
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-2xl bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:p-5">
        <h2 className={tituloClass}>Tus categorias</h2>
        <form onSubmit={crear} className="flex gap-2">
          <label htmlFor="nueva-categoria" className="sr-only">
            Nombre de la nueva categoria
          </label>
          <input
            id="nueva-categoria"
            maxLength={100}
            placeholder="Ej: Mascotas, Regalos, Cafe"
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            className={inputClass}
          />
          <Button type="submit" className="h-11 shrink-0" disabled={creando || !nombre.trim()}>
            <Plus className="size-4" aria-hidden />
            Crear
          </Button>
        </form>

        {todasQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : propias.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aun no creas categorias propias. Solo tu las ves y aparecen al registrar junto a las por defecto.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {propias.map((categoria) => (
              <FilaCategoria
                key={categoria.id_categoria}
                categoria={categoria}
                onRenombrar={(nuevo) => editarCategoria(categoria.id_categoria, { nombre: nuevo })}
                onArchivar={() => archivar(categoria)}
              />
            ))}
          </ul>
        )}
      </section>

      {archivadas.length > 0 ? (
        <section className="flex flex-col gap-2 rounded-2xl bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:p-5">
          <h2 className={tituloClass}>Archivadas</h2>
          <p className="text-xs text-muted-foreground">Tienen movimientos, pero ya no se ofrecen al registrar.</p>
          <ul className="divide-y divide-border">
            {archivadas.map((categoria) => (
              <li key={categoria.id_categoria} className="flex items-center justify-between gap-3 py-2">
                <span className="truncate text-sm text-muted-foreground">{categoria.nombre}</span>
                <Button type="button" size="sm" variant="ghost" onClick={() => void restaurar(categoria)}>
                  <ArchiveRestore className="size-4" aria-hidden />
                  Restaurar
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-3 rounded-2xl bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:p-5">
        <h2 className={tituloClass}>Por defecto</h2>
        <ul className="flex flex-wrap gap-1.5">
          {porDefecto.map((categoria) => (
            <li key={categoria.id_categoria} className="rounded-md border border-border px-2.5 py-1 text-sm">
              {categoria.nombre}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function FilaCategoria({
  categoria,
  onRenombrar,
  onArchivar,
}: {
  categoria: CategoriaResponse
  onRenombrar: (nombre: string) => Promise<{ ok: true } | { ok: false; message: string }>
  onArchivar: () => Promise<void>
}) {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(categoria.nombre)
  const [ocupado, setOcupado] = useState(false)

  const guardar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nuevo = valor.trim()
    if (!nuevo || nuevo === categoria.nombre) {
      setEditando(false)
      setValor(categoria.nombre)
      return
    }
    setOcupado(true)
    const result = await onRenombrar(nuevo)
    setOcupado(false)
    if (!result.ok) {
      toast.error("No pudimos renombrar la categoria", { description: result.message })
      return
    }
    setEditando(false)
  }

  if (editando) {
    return (
      <li className="py-2">
        <form onSubmit={guardar} className="flex gap-2">
          <label htmlFor={`renombrar-${categoria.id_categoria}`} className="sr-only">
            Nuevo nombre
          </label>
          <input
            id={`renombrar-${categoria.id_categoria}`}
            autoFocus
            maxLength={100}
            value={valor}
            onChange={(event) => setValor(event.target.value)}
            className={inputClass}
          />
          <Button type="submit" size="icon-lg" aria-label="Guardar nombre" disabled={ocupado}>
            <Check className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon-lg"
            variant="ghost"
            aria-label="Cancelar"
            onClick={() => {
              setEditando(false)
              setValor(categoria.nombre)
            }}
          >
            <X className="size-4" />
          </Button>
        </form>
      </li>
    )
  }

  return (
    <li className="flex items-center gap-1 py-1.5">
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{categoria.nombre}</span>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={`Renombrar ${categoria.nombre}`}
        className="text-muted-foreground hover:text-foreground"
        onClick={() => setEditando(true)}
      >
        <Pencil className="size-3.5" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={`Quitar ${categoria.nombre}`}
        title="Se elimina si no tiene movimientos; si tiene, se archiva"
        className="text-muted-foreground hover:text-destructive"
        disabled={ocupado}
        onClick={async () => {
          setOcupado(true)
          await onArchivar()
          setOcupado(false)
        }}
      >
        <Archive className="size-3.5" />
      </Button>
    </li>
  )
}
