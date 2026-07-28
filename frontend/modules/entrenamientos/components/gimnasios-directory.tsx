"use client"

import Link from "next/link"
import { useDeferredValue, useMemo, useState } from "react"
import { ArrowRight, MapPin, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { useEntrenamientos } from "@/modules/entrenamientos/hooks/useEntrenamientos"

const normalizeText = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()

export function GimnasiosDirectory() {
  const { gimnasios, loading } = useEntrenamientos()
  const [search, setSearch] = useState("")
  const [selectedGymId, setSelectedGymId] = useState<number | null>(null)
  const deferredSearch = useDeferredValue(search)

  const gimnasiosActivos = gimnasios.filter((gimnasio) => gimnasio.activo).length
  const filteredGimnasios = useMemo(() => {
    const normalizedSearch = normalizeText(deferredSearch)

    if (!normalizedSearch) {
      return gimnasios
    }

    const searchTerms = normalizedSearch.split(/\s+/).filter(Boolean)

    return gimnasios.filter((gimnasio) => {
      const haystack = normalizeText(
        [
          gimnasio.nombre_gimnasio,
          gimnasio.nombre_cadena,
          gimnasio.comuna,
          gimnasio.direccion,
        ]
          .filter(Boolean)
          .join(" ")
      )

      return searchTerms.every((term) => haystack.includes(term))
    })
  }, [deferredSearch, gimnasios])
  const selectedGym = useMemo(
    () => gimnasios.find((gimnasio) => gimnasio.id_gimnasio === selectedGymId) ?? null,
    [gimnasios, selectedGymId]
  )

  return (
    <section className="flex flex-col gap-6">
      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr_0.9fr]">
        <article className="rounded-[1.75rem] bg-[color:var(--surface-low)] p-6">
          <p className="font-label text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground">
            Antes de empezar
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground">
            Elige el lugar que mejor acompana tu sesion.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Este espacio te ayuda a encontrar un gimnasio que te acomode y dejar mejor enmarcado tu entrenamiento antes de abrir la sesion.
          </p>
        </article>

        <article className="rounded-[1.75rem] bg-[color:var(--surface-lowest)] p-6 shadow-[var(--shadow-airy)]">
          <p className="text-sm font-medium text-foreground">Opciones para hoy</p>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
            {filteredGimnasios.length}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Lugares que puedes revisar segun tu busqueda actual.
          </p>
        </article>

        <article className="rounded-[1.75rem] bg-[color:var(--surface-lowest)] p-6 shadow-[var(--shadow-airy)]">
          <p className="text-sm font-medium text-foreground">Tu siguiente paso</p>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-foreground">{gimnasiosActivos}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Explora con calma y elige donde quieres registrar tu entrenamiento.
          </p>
        </article>
      </section>

      <section className="rounded-[1.75rem] bg-[color:var(--surface-low)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="font-label text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground">
              Directorio
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              Gimnasios disponibles
            </h3>
          </div>
          <div className="flex w-full max-w-md items-center gap-3 rounded-[1.25rem] bg-[color:var(--surface-lowest)] px-4 py-3 shadow-[var(--shadow-airy)]">
            <Search className="size-4 shrink-0 text-[color:var(--module-entrenamientos)]" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por gimnasio, cadena o comuna"
              className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
            />
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Busca por nombre, cadena, comuna o direccion para encontrar un lugar que se ajuste mejor a tu rutina.
        </p>

        {loading ? (
          <div className="mt-6 rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-6 text-sm text-muted-foreground shadow-[var(--shadow-airy)]">
            Estamos preparando tus opciones de entrenamiento...
          </div>
        ) : gimnasios.length === 0 ? (
          <div className="mt-6 rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-6 text-sm leading-6 text-muted-foreground shadow-[var(--shadow-airy)]">
            Aun no hay gimnasios disponibles para explorar. Vuelve mas tarde y retomamos desde aqui.
          </div>
        ) : filteredGimnasios.length === 0 ? (
          <div className="mt-6 rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-6 text-sm leading-6 text-muted-foreground shadow-[var(--shadow-airy)]">
            No encontramos un gimnasio para <span className="font-medium text-foreground">{search}</span>.
            Prueba con otra comuna, una cadena o una parte de la direccion para seguir buscando tu proximo lugar de entrenamiento.
          </div>
        ) : (
          <>
            <div className="mt-6 hidden overflow-hidden rounded-[1.5rem] bg-[color:var(--surface-low)] shadow-[0_8px_48px_-12px_rgba(0,0,0,0.05)] lg:block">
              <Table>
                <TableHeader className="bg-[color:var(--module-entrenamientos)] text-[color:var(--tertiary-foreground)]">
                  <TableRow className="border-0 hover:bg-transparent">
                    <TableHead className="px-8 py-5 font-label text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--tertiary-foreground)]">
                      Gimnasio
                    </TableHead>
                    <TableHead className="px-6 py-5 font-label text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--tertiary-foreground)]">
                      Cadena
                    </TableHead>
                    <TableHead className="px-6 py-5 font-label text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--tertiary-foreground)]">
                      Comuna
                    </TableHead>
                    <TableHead className="px-6 py-5 font-label text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--tertiary-foreground)]">
                      Direccion
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_tr:not(:last-child)]:border-b [&_tr:not(:last-child)]:border-[color:var(--border)]/30">
                  {filteredGimnasios.map((gimnasio, index) => (
                    <TableRow
                      key={gimnasio.id_gimnasio}
                      role="button"
                      tabIndex={0}
                      className={cn(
                        "cursor-pointer border-0 transition-colors hover:bg-tertiary/8 focus-visible:bg-tertiary/8",
                        index % 2 === 0
                          ? "bg-[color:var(--surface-lowest)]"
                          : "bg-[color:var(--surface-low)]"
                      )}
                      onClick={() => setSelectedGymId(gimnasio.id_gimnasio)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          setSelectedGymId(gimnasio.id_gimnasio)
                        }
                      }}
                    >
                      <TableCell className="px-8 py-5 font-medium text-foreground">{gimnasio.nombre_gimnasio}</TableCell>
                      <TableCell className="px-6 py-5">{gimnasio.nombre_cadena ?? "-"}</TableCell>
                      <TableCell className="px-6 py-5">{gimnasio.comuna ?? "-"}</TableCell>
                      <TableCell className="px-6 py-5 text-sm text-muted-foreground">
                        {gimnasio.direccion}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-6 grid gap-4 lg:hidden">
              {filteredGimnasios.map((gimnasio) => (
                <article
                  key={gimnasio.id_gimnasio}
                  className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-5 shadow-[var(--shadow-airy)]"
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedGymId(gimnasio.id_gimnasio)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      setSelectedGymId(gimnasio.id_gimnasio)
                    }
                  }}
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-semibold tracking-tight text-foreground">
                          {gimnasio.nombre_gimnasio}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {gimnasio.nombre_cadena ?? "Cadena no informada"}
                        </p>
                      </div>
                      <ArrowRight className="mt-1 size-4 text-[color:var(--module-entrenamientos)]" />
                    </div>

                    <div className="rounded-[1.25rem] bg-[color:var(--surface-low)] p-4">
                      <p className="font-label text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground">
                        Ubicacion
                      </p>
                      <p className="mt-2 flex items-start gap-2 text-sm text-foreground">
                        <MapPin className="mt-0.5 size-4 text-[color:var(--module-entrenamientos)]" />
                        <span>{gimnasio.direccion}</span>
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">{gimnasio.comuna ?? "-"}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      <Dialog open={selectedGym !== null} onOpenChange={(open) => (open ? undefined : setSelectedGymId(null))}>
        <DialogContent className="max-w-xl rounded-[1.75rem] border-0 bg-[color:var(--surface-lowest)] p-0 shadow-[var(--shadow-airy-lg)]">
          <div className="bg-[linear-gradient(135deg,color-mix(in_oklch,var(--module-entrenamientos)_14%,white),transparent_70%)] px-6 py-6 sm:px-7">
            <DialogHeader className="text-left">
              <p className="font-label text-[0.72rem] uppercase tracking-[0.24em] text-muted-foreground">
                Tu proxima sesion
              </p>
              <DialogTitle className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground">
                {selectedGym ? "Quieres registrar tu entrenamiento en este gimnasio?" : ""}
              </DialogTitle>
              <DialogDescription className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
                {selectedGym
                  ? `Si este lugar te acomoda para hoy, lo tomaremos como punto de partida para abrir tu sesion y empezar a registrar tus series.`
                  : ""}
              </DialogDescription>
            </DialogHeader>
          </div>

          {selectedGym ? (
            <div className="px-6 pb-6 sm:px-7">
              <div className="rounded-[1.5rem] bg-[color:var(--surface-low)] p-5">
                <p className="text-lg font-semibold tracking-tight text-foreground">
                  {selectedGym.nombre_gimnasio}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedGym.nombre_cadena ?? "Cadena no informada"} · {selectedGym.comuna ?? "Comuna no informada"}
                </p>
                <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-foreground">
                  <MapPin className="mt-1 size-4 shrink-0 text-[color:var(--module-entrenamientos)]" />
                  <span>{selectedGym.direccion}</span>
                </p>
              </div>

              <DialogFooter className="mt-5">
                <Button variant="ghost" onClick={() => setSelectedGymId(null)}>
                  Seguir explorando
                </Button>
                <Button
                  asChild
                  className="bg-[color:var(--module-entrenamientos)] text-[color:var(--tertiary-foreground)] hover:bg-[color:var(--module-entrenamientos)]/90"
                >
                  <Link href={`/app/entrenamientos/registrar?id_gimnasio=${selectedGym.id_gimnasio}`}>
                    Elegir este gimnasio
                  </Link>
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  )
}
