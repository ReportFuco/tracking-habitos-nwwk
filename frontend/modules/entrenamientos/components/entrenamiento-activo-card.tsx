"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  CloudOff,
  PencilLine,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { SearchableCombobox } from "@/components/forms/searchable-combobox";
import { Button } from "@/components/ui/button";
import { FieldGroup, FormNote } from "@/components/forms/editorial-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEntrenamientos } from "@/modules/entrenamientos/hooks/useEntrenamientos";
import { isSeriePendiente } from "@/modules/entrenamientos/offline/entrenamientos-offline";
import {
  serieFuerzaCreateSchema,
  serieFuerzaPatchSchema,
} from "@/modules/entrenamientos/schemas/entrenamientos.schema";
import { Musculo, SerieFuerzaResponse } from "@/modules/entrenamientos/types/entrenamientos";

const initialForm = {
  id_ejercicio: "",
  id_musculo: "",
  es_calentamiento: false,
  cantidad_peso: "",
  repeticiones: "",
};

const inputClassName =
  "h-12 w-full rounded-[1rem] border-0 bg-[color:var(--surface-variant)] px-4 text-base text-foreground outline-none transition placeholder:text-muted-foreground focus:border-b-2 focus:border-[color:var(--module-entrenamientos)] sm:h-13 sm:text-sm";

const normalizeText = (value: string | null | undefined) =>
  (value ?? "").trim().toLowerCase();

const ULTIMA_SERIE_LS_KEY = "ut_series_cache";

type CachedSerie = {
  cantidad_peso: string;
  repeticiones: string;
  es_calentamiento: boolean;
};

function saveUltimaSerieLocal(idEjercicio: number, data: CachedSerie) {
  try {
    const raw = localStorage.getItem(ULTIMA_SERIE_LS_KEY);
    const cache: Record<number, CachedSerie> = raw
      ? (JSON.parse(raw) as Record<number, CachedSerie>)
      : {};
    cache[idEjercicio] = data;
    localStorage.setItem(ULTIMA_SERIE_LS_KEY, JSON.stringify(cache));
  } catch {}
}

function loadUltimaSerieLocal(idEjercicio: number): CachedSerie | null {
  try {
    const raw = localStorage.getItem(ULTIMA_SERIE_LS_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as Record<number, CachedSerie>;
    return cache[idEjercicio] ?? null;
  } catch {
    return null;
  }
}

const getEditableForm = (serie: SerieFuerzaResponse, musculos: Musculo[]) => ({
  id_ejercicio: "",
  id_musculo: String(
    musculos.find(
      (musculo) =>
        normalizeText(musculo.nombre) === normalizeText(serie.tipo_ejercicio) ||
        normalizeText(musculo.codigo) === normalizeText(serie.tipo_ejercicio),
    )?.id_musculo ?? "",
  ),
  es_calentamiento: serie.es_calentamiento,
  cantidad_peso: String(serie.cantidad_peso),
  repeticiones: String(serie.repeticiones),
});

const formatEjercicioGrupo = (ejercicio: {
  musculo_nombre?: string | null;
  subcategoria_nombre?: string | null;
  tipo?: string | null;
}) => {
  const musculo = ejercicio.musculo_nombre ?? ejercicio.tipo ?? "";
  const subcategoria = ejercicio.subcategoria_nombre;

  if (!subcategoria || subcategoria.toLowerCase() === "general") {
    return musculo || undefined;
  }

  return musculo ? `${musculo} / ${subcategoria}` : subcategoria;
};

const formatSerieGrupo = (serie: SerieFuerzaResponse) => {
  const musculo = serie.tipo_ejercicio ?? "";
  const subcategoria = serie.subcategoria_ejercicio;

  if (!subcategoria || subcategoria.toLowerCase() === "general") {
    return musculo;
  }

  return musculo ? `${musculo} / ${subcategoria}` : subcategoria;
};

export function EntrenamientoActivoCard() {
  const {
    entrenamientoActivo,
    ejercicios,
    musculos,
    loading,
    submitting,
    fetchEjercicios,
    fetchMusculos,
    agregarSerieFuerza,
    editarSerieFuerza,
    eliminarSerieFuerza,
    cerrarEntrenoFuerzaActivo,
  } = useEntrenamientos();
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [formOpen, setFormOpen] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingForm, setEditingForm] = useState(initialForm);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);

  const toggleGroup = (key: string) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  useEffect(() => {
    if (ejercicios.length === 0) {
      void fetchEjercicios();
    }

    if (musculos.length === 0) {
      void fetchMusculos();
    }
  }, [
    ejercicios.length,
    fetchEjercicios,
    fetchMusculos,
    musculos.length,
  ]);

  const handleEjercicioChange = (value: string) => {
    if (!value) {
      setForm((prev) => ({ ...prev, id_ejercicio: "" }));
      return;
    }

    const ejercicioId = Number(value);
    const ejercicio = ejercicios.find((e) => e.id_ejercicio === ejercicioId);

    const match =
      ejercicio && entrenamientoActivo?.series?.length
        ? entrenamientoActivo.series
            .filter(
              (s) =>
                normalizeText(s.nombre_ejercicio) ===
                normalizeText(ejercicio.nombre),
            )
            .at(-1)
        : undefined;

    if (match) {
      setForm((prev) => ({
        ...prev,
        id_ejercicio: value,
        cantidad_peso: String(match.cantidad_peso),
        repeticiones: String(match.repeticiones),
        es_calentamiento: match.es_calentamiento,
      }));
      return;
    }

    const local = loadUltimaSerieLocal(ejercicioId);
    if (local) {
      setForm((prev) => ({
        ...prev,
        id_ejercicio: value,
        cantidad_peso: local.cantidad_peso,
        repeticiones: local.repeticiones,
        es_calentamiento: local.es_calentamiento,
      }));
      return;
    }

    setForm((prev) => ({ ...prev, id_ejercicio: value }));
  };

  const ejerciciosFiltrados = useMemo(() => {
    if (!form.id_musculo) {
      return [];
    }

    return ejercicios.filter(
      (ejercicio) => ejercicio.id_musculo === Number(form.id_musculo),
    );
  }, [ejercicios, form.id_musculo]);

  const ejerciciosFiltradosEdicion = useMemo(() => {
    if (!editingForm.id_musculo) {
      return [];
    }

    return ejercicios.filter(
      (ejercicio) => ejercicio.id_musculo === Number(editingForm.id_musculo),
    );
  }, [editingForm.id_musculo, ejercicios]);

  const musculoOptions = useMemo(
    () =>
      musculos.filter((musculo) => musculo.activo).map((musculo) => ({
        value: String(musculo.id_musculo),
        label: musculo.nombre,
      })),
    [musculos],
  );

  const ejercicioOptions = useMemo(
    () =>
      ejerciciosFiltrados.map((ejercicio) => ({
        value: String(ejercicio.id_ejercicio),
        label: ejercicio.nombre,
        description: formatEjercicioGrupo(ejercicio),
      })),
    [ejerciciosFiltrados],
  );

  const ejercicioOptionsEdicion = useMemo(
    () =>
      ejerciciosFiltradosEdicion.map((ejercicio) => ({
        value: String(ejercicio.id_ejercicio),
        label: ejercicio.nombre,
        description: formatEjercicioGrupo(ejercicio),
      })),
    [ejerciciosFiltradosEdicion],
  );

  const seriesAgrupadas = useMemo(() => {
    const groups = new Map<
      string,
      { tipo: string; series: SerieFuerzaResponse[] }
    >();
    for (const serie of entrenamientoActivo?.series ?? []) {
      const key = serie.nombre_ejercicio ?? `serie_${serie.id_fuerza_detalle}`;
      if (!groups.has(key))
        groups.set(key, { tipo: formatSerieGrupo(serie), series: [] });
      groups.get(key)!.series.push(serie);
    }
    return groups;
  }, [entrenamientoActivo?.series]);

  const totalSeries = entrenamientoActivo?.series?.length ?? 0;
  const seriesTrabajo =
    entrenamientoActivo?.series?.filter((serie) => !serie.es_calentamiento)
      .length ?? 0;
  const seriesCalentamiento = totalSeries - seriesTrabajo;

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsed = serieFuerzaCreateSchema.safeParse({
      id_ejercicio: Number(form.id_ejercicio),
      es_calentamiento: form.es_calentamiento,
      cantidad_peso: Number(form.cantidad_peso),
      repeticiones: Number(form.repeticiones),
    });

    if (!parsed.success) {
      toast.error("Revisa la serie", {
        description:
          parsed.error.issues[0]?.message ?? "Completa los datos requeridos.",
      });
      return;
    }

    const result = await agregarSerieFuerza(parsed.data);

    if (result.ok) {
      saveUltimaSerieLocal(Number(form.id_ejercicio), {
        cantidad_peso: form.cantidad_peso,
        repeticiones: form.repeticiones,
        es_calentamiento: form.es_calentamiento,
      });
      setForm((prev) => ({ ...prev, cantidad_peso: "", repeticiones: "" }));
      setFormOpen(false);
      toast.success("Serie agregada", {
        description: "Tu registro ya quedo guardado en esta sesion.",
      });
      return;
    }

    toast.error("No pudimos guardar la serie", {
      description: result.message,
    });
  };

  const handleSave = async (idFuerzaDetalle: number) => {
    const payload = {
      id_ejercicio: editingForm.id_ejercicio
        ? Number(editingForm.id_ejercicio)
        : null,
      es_calentamiento: editingForm.es_calentamiento,
      cantidad_peso: Number(editingForm.cantidad_peso),
      repeticiones: Number(editingForm.repeticiones),
    };

    const parsed = serieFuerzaPatchSchema.safeParse(payload);

    if (!parsed.success) {
      toast.error("Revisa la serie", {
        description:
          parsed.error.issues[0]?.message ??
          "Ajusta los datos antes de guardar.",
      });
      return;
    }

    const result = await editarSerieFuerza(idFuerzaDetalle, parsed.data);

    if (result.ok) {
      setEditingId(null);
      setEditingForm(initialForm);
      toast.success("Serie actualizada", {
        description: "Los cambios ya quedaron guardados.",
      });
      return;
    }

    toast.error("No pudimos actualizar la serie", {
      description: result.message,
    });
  };

  const handleDelete = async (idFuerzaDetalle: number) => {
    const result = await eliminarSerieFuerza(idFuerzaDetalle);

    if (result.ok) {
      toast.success("Serie eliminada", {
        description: "La quitamos de esta sesion.",
      });
      return;
    }

    toast.error("No pudimos eliminar la serie", {
      description: result.message,
    });
  };

  const handleClose = async () => {
    const result = await cerrarEntrenoFuerzaActivo();

    if (result.ok) {
      toast.success("Sesion cerrada", {
        description: "Tu entrenamiento ya paso al historico.",
      });
      router.push("/app/entrenamientos");
      return;
    }

    toast.error("No pudimos cerrar la sesion", {
      description: result.message,
    });
  };

  if (!entrenamientoActivo) {
    return (
      <section className="rounded-[1.5rem] bg-surface-low p-4 sm:rounded-[1.75rem] sm:p-6">
        <div className="rounded-4xl p-5 shadow-(--shadow-airy) sm:rounded-[1.5rem] sm:p-6">
          <p className="font-label text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground sm:text-[0.72rem] sm:tracking-[0.24em]">
            Sin sesion activa
          </p>
          <h2 className="mt-2 text-xl font-semibold leading-tight tracking-[-0.02em] text-foreground sm:mt-3 sm:text-3xl sm:tracking-[-0.03em]">
            Todavia no hay un entrenamiento en curso.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Primero abre tu entrenamiento y luego vuelve aqui para empezar a
            registrar tus series.
          </p>
          <Button
            asChild
            className="mt-5 bg-[color:var(--module-entrenamientos)] text-[color:var(--tertiary-foreground)] hover:bg-[color:var(--module-entrenamientos)]/90"
          >
            <Link href="/app/entrenamientos/registrar">
              Registrar entrenamiento
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="grid min-w-0 gap-4 sm:gap-6 xl:grid-cols-[1.08fr_0.92fr]">
      <section className="order-2 min-w-0 rounded-[1.5rem] bg-[color:var(--surface-low)] p-4 sm:rounded-[1.75rem] sm:p-6 xl:order-none">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="hidden xl:block">
            <p className="font-label text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground sm:text-[0.7rem] sm:tracking-[0.22em]">
              Sesion actual
            </p>
            <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-foreground sm:mt-2 sm:text-2xl">
              Series registradas
            </h2>
            {entrenamientoActivo.nombre_gimnasio ? (
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                {entrenamientoActivo.nombre_gimnasio}
              </p>
            ) : null}
          </div>
          <div className="flex min-w-0 items-center justify-between gap-2 sm:gap-3">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] sm:px-3 sm:tracking-[0.18em]"
              style={{
                background:
                  "color-mix(in oklch, var(--module-entrenamientos) 10%, transparent)",
                color: "var(--module-entrenamientos)",
              }}
            >
              {totalSeries} serie{totalSeries === 1 ? "" : "s"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCloseDialogOpen(true)}
              disabled={submitting}
              className="text-foreground hover:text-primary"
            >
              {submitting ? "Cerrando..." : "Cerrar"}
            </Button>
          </div>
        </div>

        {totalSeries > 0 ? (
          <div className="mt-4 space-y-2 rounded-[1rem] bg-[color:var(--surface-lowest)] p-3 sm:mt-5 sm:rounded-[1.25rem] sm:p-4">
            <div className="flex min-w-0 items-center justify-between gap-3 text-[11px] text-muted-foreground sm:text-xs">
              <span className="font-label uppercase tracking-[0.18em]">
                Reparto
              </span>
              <span className="min-w-0 text-right">
                {seriesTrabajo} trabajo · {seriesCalentamiento} calentamiento
              </span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-[color:var(--surface-variant)]">
              {seriesTrabajo > 0 ? (
                <div
                  className="h-full"
                  style={{
                    width: `${(seriesTrabajo / totalSeries) * 100}%`,
                    background: "var(--module-entrenamientos)",
                  }}
                />
              ) : null}
              {seriesCalentamiento > 0 ? (
                <div
                  className="h-full"
                  style={{
                    width: `${(seriesCalentamiento / totalSeries) * 100}%`,
                    background:
                      "color-mix(in oklch, var(--module-entrenamientos) 35%, transparent)",
                  }}
                />
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-4 space-y-3 sm:mt-6 sm:space-y-4">
          {seriesAgrupadas.size > 0 ? (
            Array.from(seriesAgrupadas.entries()).map(
              ([ejercicioKey, { tipo, series }]) => {
                const isOpen = expandedGroups.has(ejercicioKey);
                const trabajoCount = series.filter(
                  (s) => !s.es_calentamiento,
                ).length;
                const calenCount = series.length - trabajoCount;
                const isEditingInGroup = series.some(
                  (s) => s.id_fuerza_detalle === editingId,
                );

                return (
                  <article
                    key={ejercicioKey}
                    className="overflow-hidden rounded-[1.25rem] bg-[color:var(--surface-lowest)] shadow-[var(--shadow-airy)] sm:rounded-[1.5rem]"
                  >
                    {/* Group header */}
                    <button
                      type="button"
                      onClick={() => toggleGroup(ejercicioKey)}
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5 sm:py-4"
                    >
                      <div className="min-w-0 flex-1">
                        {tipo ? (
                          <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:text-xs">
                            {tipo}
                          </p>
                        ) : null}
                        <p className="truncate text-sm font-semibold tracking-tight text-foreground sm:text-base">
                          {ejercicioKey}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">
                          {trabajoCount > 0 && `${trabajoCount}T`}
                          {trabajoCount > 0 && calenCount > 0 && " · "}
                          {calenCount > 0 && `${calenCount}C`}
                        </span>
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em]"
                          style={{
                            background:
                              "color-mix(in oklch, var(--module-entrenamientos) 10%, transparent)",
                            color: "var(--module-entrenamientos)",
                          }}
                        >
                          {series.length}{" "}
                          {series.length === 1 ? "serie" : "series"}
                        </span>
                        <ChevronDown
                          className="size-4 text-muted-foreground transition-transform duration-300"
                          style={{
                            transform:
                              isOpen || isEditingInGroup
                                ? "rotate(180deg)"
                                : "rotate(0deg)",
                          }}
                        />
                      </div>
                    </button>

                    {/* Collapsible series list */}
                    <div
                      className="grid transition-[grid-template-rows] duration-300 ease-in-out"
                      style={{
                        gridTemplateRows:
                          isOpen || isEditingInGroup ? "1fr" : "0fr",
                      }}
                    >
                      <div className="overflow-hidden">
                        <div className="space-y-2 border-t border-[color:var(--border)]/20 px-4 py-3 sm:px-5 sm:py-4">
                          {series.map((serie) => (
                            <div
                              key={serie.id_fuerza_detalle}
                              className="rounded-[0.875rem] bg-[color:var(--surface-low)] p-3 sm:p-4"
                            >
                              {editingId === serie.id_fuerza_detalle ? (
                                <div className="space-y-4 sm:space-y-5">
                                  <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                                    <FieldGroup label="Musculo">
                                      <SearchableCombobox
                                        value={editingForm.id_musculo}
                                        onChange={(value) =>
                                          setEditingForm((prev) => ({
                                            ...prev,
                                            id_musculo: value,
                                            id_ejercicio: "",
                                          }))
                                        }
                                        options={musculoOptions}
                                        placeholder="Selecciona un grupo muscular"
                                        searchPlaceholder="Buscar grupo muscular..."
                                        emptyMessage="No hay grupos musculares"
                                        loading={
                                          loading &&
                                          musculoOptions.length === 0
                                        }
                                        loadingMessage="Cargando grupos..."
                                      />
                                    </FieldGroup>
                                    <FieldGroup label="Ejercicio">
                                      <SearchableCombobox
                                        value={editingForm.id_ejercicio}
                                        onChange={(value) =>
                                          setEditingForm((prev) => ({
                                            ...prev,
                                            id_ejercicio: value,
                                          }))
                                        }
                                        options={ejercicioOptionsEdicion}
                                        placeholder="Mantener ejercicio actual"
                                        searchPlaceholder="Buscar ejercicio..."
                                        emptyMessage="No hay ejercicios para este grupo"
                                        disabled={
                                          submitting || !editingForm.id_musculo
                                        }
                                        disabledMessage="Primero elige un grupo"
                                        loading={
                                          loading &&
                                          ejercicioOptionsEdicion.length === 0
                                        }
                                        loadingMessage="Cargando ejercicios..."
                                      />
                                    </FieldGroup>
                                  </div>
                                  <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                                    <FieldGroup label="Peso" hint="Kg">
                                      <input
                                        type="number"
                                        inputMode="decimal"
                                        min="0"
                                        step="0.5"
                                        className={inputClassName}
                                        value={editingForm.cantidad_peso}
                                        onChange={(event) =>
                                          setEditingForm((prev) => ({
                                            ...prev,
                                            cantidad_peso: event.target.value,
                                          }))
                                        }
                                      />
                                    </FieldGroup>
                                    <FieldGroup label="Repeticiones">
                                      <input
                                        type="number"
                                        inputMode="numeric"
                                        min="1"
                                        step="1"
                                        className={inputClassName}
                                        value={editingForm.repeticiones}
                                        onChange={(event) =>
                                          setEditingForm((prev) => ({
                                            ...prev,
                                            repeticiones: event.target.value,
                                          }))
                                        }
                                      />
                                    </FieldGroup>
                                  </div>
                                  <label className="flex items-center gap-3 rounded-[1rem] bg-primary/6 px-4 py-3 text-sm text-foreground">
                                    <input
                                      type="checkbox"
                                      className="size-4 accent-primary"
                                      checked={editingForm.es_calentamiento}
                                      onChange={(event) =>
                                        setEditingForm((prev) => ({
                                          ...prev,
                                          es_calentamiento:
                                            event.target.checked,
                                        }))
                                      }
                                    />
                                    Serie de calentamiento
                                  </label>
                                  <div className="flex flex-wrap gap-2 sm:gap-3">
                                    <Button
                                      onClick={() =>
                                        handleSave(serie.id_fuerza_detalle)
                                      }
                                      disabled={submitting}
                                      className="bg-primary text-[color:var(--primary-foreground)] hover:bg-primary/90"
                                    >
                                      Guardar cambios
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      onClick={() => {
                                        setEditingId(null);
                                        setEditingForm(initialForm);
                                      }}
                                    >
                                      Cancelar
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex min-w-0 items-center justify-between gap-3">
                                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                                    <span
                                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] ${
                                        serie.es_calentamiento
                                          ? "bg-primary/10 text-primary"
                                          : "bg-foreground/5 text-foreground"
                                      }`}
                                    >
                                      {serie.es_calentamiento ? "C" : "T"}
                                    </span>
                                    <span className="text-sm font-semibold text-foreground">
                                      {serie.cantidad_peso}{" "}
                                      <span className="text-xs font-normal text-muted-foreground">
                                        kg
                                      </span>
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      · {serie.repeticiones} reps
                                    </span>
                                  </div>
                                  {isSeriePendiente(serie) ? (
                                    // Serie encolada sin conexion: todavia no tiene id del
                                    // backend, asi que editarla o borrarla apuntaria a un
                                    // id inexistente. Se muestra el estado y nada mas.
                                    <span
                                      title="Se enviara al recuperar la conexion"
                                      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
                                    >
                                      <CloudOff className="size-3" aria-hidden />
                                      Pendiente
                                    </span>
                                  ) : (
                                    <div className="flex shrink-0 gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setEditingId(serie.id_fuerza_detalle);
                                          setEditingForm(getEditableForm(serie, musculos));
                                        }}
                                        className="h-7 px-2 text-foreground hover:text-primary"
                                      >
                                        <PencilLine className="size-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          handleDelete(serie.id_fuerza_detalle)
                                        }
                                        className="h-7 px-2 text-foreground hover:text-destructive"
                                      >
                                        <Trash2 className="size-3.5" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              },
            )
          ) : (
            <div className="rounded-[1.25rem] bg-[color:var(--surface-lowest)] p-5 text-sm leading-6 text-muted-foreground shadow-[var(--shadow-airy)] sm:rounded-[1.5rem] sm:p-6">
              Aun no registras series en esta sesion. Agrega la primera desde el
              panel <span className="sm:hidden">de arriba</span>
              <span className="hidden sm:inline">lateral</span> y aparecera aqui
              al instante.
            </div>
          )}
        </div>
      </section>

      <div className="order-1 min-w-0 space-y-4 sm:space-y-6 xl:order-none">
        <section className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] shadow-[var(--shadow-airy-lg)] sm:rounded-[1.75rem]">
          <button
            type="button"
            onClick={() => setFormOpen((prev) => !prev)}
            className="flex w-full items-center justify-between px-4 py-4 sm:px-6 sm:py-5 xl:hidden"
          >
            <span className="inline-flex items-center gap-2 font-label text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground sm:text-[0.68rem] sm:tracking-[0.22em]">
              <span
                aria-hidden
                className="size-1.5 rounded-full transition-colors"
                style={{ background: "var(--module-entrenamientos)" }}
              />
              Nueva serie
            </span>
            <ChevronDown
              className="size-4 text-muted-foreground transition-transform duration-300"
              style={{
                transform: formOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
            />
          </button>

          <div
            className="grid transition-[grid-template-rows] duration-300 ease-in-out xl:grid-rows-[1fr]!"
            style={{ gridTemplateRows: formOpen ? "1fr" : "0fr" }}
          >
            <div className="overflow-hidden">
              <form
                onSubmit={handleCreate}
                className="space-y-4 px-4 pb-5 sm:space-y-5 sm:px-6 sm:pb-7 xl:pt-5"
              >
                <div className="grid gap-4 sm:gap-5">
                  <FieldGroup label="Grupo muscular">
                    <SearchableCombobox
                      value={form.id_musculo}
                      onChange={(value) =>
                        setForm((prev) => ({
                          ...prev,
                          id_musculo: value,
                          id_ejercicio: "",
                        }))
                      }
                      options={musculoOptions}
                      disabled={submitting || loading}
                      placeholder="Selecciona un grupo muscular"
                      searchPlaceholder="Buscar grupo muscular..."
                      emptyMessage="No hay grupos musculares"
                      loading={loading && musculoOptions.length === 0}
                      loadingMessage="Cargando grupos..."
                    />
                  </FieldGroup>

                  <FieldGroup
                    label="Ejercicio"
                    hint={form.id_musculo ? "Disponibles para el grupo" : ""}
                  >
                    <SearchableCombobox
                      value={form.id_ejercicio}
                      onChange={handleEjercicioChange}
                      options={ejercicioOptions}
                      disabled={submitting || !form.id_musculo}
                      disabledMessage="Primero elige un grupo"
                      placeholder={
                        form.id_musculo
                          ? "Selecciona un ejercicio"
                          : "Primero elige un grupo"
                      }
                      searchPlaceholder="Buscar ejercicio..."
                      emptyMessage="No hay ejercicios para este grupo"
                      loading={loading && ejercicioOptions.length === 0}
                      loadingMessage="Cargando ejercicios..."
                    />
                  </FieldGroup>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                  <FieldGroup label="Peso" hint="Kg">
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.5"
                      className={inputClassName}
                      placeholder="Ej: 60"
                      value={form.cantidad_peso}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          cantidad_peso: event.target.value,
                        }))
                      }
                    />
                  </FieldGroup>

                  <FieldGroup label="Repeticiones">
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      step="1"
                      className={inputClassName}
                      placeholder="Ej: 10"
                      value={form.repeticiones}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          repeticiones: event.target.value,
                        }))
                      }
                    />
                  </FieldGroup>
                </div>

                <label
                  className="flex items-center gap-3 rounded-[1rem] px-4 py-3 text-sm text-foreground"
                  style={{
                    background:
                      "color-mix(in oklch, var(--module-entrenamientos) 8%, transparent)",
                  }}
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-[color:var(--module-entrenamientos)]"
                    checked={form.es_calentamiento}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        es_calentamiento: event.target.checked,
                      }))
                    }
                  />
                  Marcar como serie de calentamiento
                </label>

                <FormNote>
                  Esta sesion se esta registrando en{" "}
                  <span className="font-medium text-foreground">
                    {entrenamientoActivo.nombre_gimnasio ??
                      "tu gimnasio actual"}
                  </span>
                  .
                </FormNote>

                <Button
                  type="submit"
                  disabled={submitting || !form.id_ejercicio}
                  className="w-full bg-[color:var(--module-entrenamientos)] text-[color:var(--tertiary-foreground)] hover:bg-[color:var(--module-entrenamientos)]/90 sm:w-auto"
                >
                  <Plus className="size-4" />
                  {submitting ? "Guardando..." : "Agregar serie"}
                </Button>
              </form>
            </div>
          </div>
        </section>
      </div>

      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent className="sm:max-w-xl rounded-[1.5rem] border-0 bg-[color:var(--surface-lowest)] p-0 shadow-[var(--shadow-airy-lg)] sm:rounded-[1.75rem]">
          <div className="bg-[linear-gradient(135deg,color-mix(in_oklch,var(--primary)_14%,white),transparent_70%)] px-5 py-5 sm:px-7 sm:py-6">
            <DialogHeader className="text-left">
              <p className="font-label text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground sm:text-[0.72rem] sm:tracking-[0.24em]">
                Confirmacion
              </p>
              <DialogTitle className="mt-2 text-xl font-semibold tracking-[-0.02em] text-foreground sm:text-2xl sm:tracking-[-0.03em]">
                Estas seguro de cerrar el entrenamiento?
              </DialogTitle>
              <DialogDescription className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground sm:mt-3">
                Si cierras la sesion ahora, este entrenamiento pasara al
                historico y dejaras de registrar series en curso.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-5 pb-5 sm:px-7 sm:pb-6">
            <div className="rounded-[1.25rem] bg-[color:var(--surface-low)] p-4 sm:rounded-[1.5rem] sm:p-5">
              <p className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                {entrenamientoActivo.nombre_gimnasio ?? "Entrenamiento actual"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {totalSeries} serie{totalSeries === 1 ? "" : "s"} registradas en
                esta sesion.
              </p>
            </div>

            <DialogFooter className="mt-4 sm:mt-5">
              <Button variant="ghost" onClick={() => setCloseDialogOpen(false)}>
                Seguir entrenando
              </Button>
              <Button
                onClick={async () => {
                  await handleClose();
                  setCloseDialogOpen(false);
                }}
                disabled={submitting}
                className="bg-primary text-[color:var(--primary-foreground)] hover:bg-primary/90"
              >
                {submitting ? "Cerrando..." : "Si, cerrar entrenamiento"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
