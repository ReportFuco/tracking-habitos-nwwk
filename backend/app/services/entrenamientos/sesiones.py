"""Consultas del historial de fuerza para el MCP: sesiones, detalle, progreso por
ejercicio, resumen semanal y busqueda en el catalogo."""
from collections import defaultdict
from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Ejercicios,
    Entrenamiento,
    EntrenamientoFuerza,
    Musculo,
    SerieFuerza,
    SubcategoriaMusculo,
)
from app.schemas.entrenamientos.analisis import (
    EjercicioBusqueda,
    ProgresoEjercicio,
    ProgresoSesion,
    SemanaResumen,
    SerieDetalle,
    SesionDetalle,
    SesionResumen,
)
from app.services.entrenamientos.carga import CHILE_TZ, es_con_mancuernas, zona_principal
from app.services.entrenamientos.texto import normalizar
from app.services.errores import NoEncontrado


def rm_estimado(peso: float, repeticiones: int) -> float:
    """1RM estimado con la formula de Epley; con 1 repeticion es el propio peso."""
    if repeticiones <= 1:
        return peso
    return peso * (1 + repeticiones / 30)


def _opciones_sesion():
    return (
        selectinload(EntrenamientoFuerza.gimnasio),
        selectinload(EntrenamientoFuerza.series)
        .selectinload(SerieFuerza.ejercicio)
        .selectinload(Ejercicios.subcategoria_musculo)
        .selectinload(SubcategoriaMusculo.musculo),
    )


def _resumen(sesion: EntrenamientoFuerza) -> SesionResumen:
    series = sorted(sesion.series, key=lambda serie: serie.id_fuerza_detalle)
    trabajo = [serie for serie in series if not serie.es_calentamiento]
    ejercicios = list(dict.fromkeys(serie.ejercicio.nombre for serie in series))
    zonas = []
    for serie in trabajo:
        subcategoria = serie.ejercicio.subcategoria_musculo
        zona = zona_principal(subcategoria.musculo.codigo, subcategoria.codigo)
        if zona and zona not in zonas:
            zonas.append(zona)
    duracion = (
        int((sesion.fin_at - sesion.inicio_at).total_seconds() // 60) if sesion.fin_at else None
    )
    return SesionResumen(
        id_entrenamiento_fuerza=sesion.id_entrenamiento_fuerza,
        inicio=sesion.inicio_at.astimezone(CHILE_TZ),
        fin=sesion.fin_at.astimezone(CHILE_TZ) if sesion.fin_at else None,
        duracion_minutos=duracion,
        estado=getattr(sesion.estado, "value", sesion.estado),
        gimnasio=sesion.gimnasio.nombre_gimnasio if sesion.gimnasio else None,
        series_trabajo=len(trabajo),
        series_calentamiento=len(series) - len(trabajo),
        ejercicios=ejercicios,
        zonas=zonas,
    )


async def listar_sesiones(
    db: AsyncSession,
    id_usuario: int,
    *,
    desde: date | None = None,
    hasta: date | None = None,
    limite: int = 20,
) -> list[SesionResumen]:
    consulta = (
        select(EntrenamientoFuerza)
        .join(Entrenamiento, Entrenamiento.id_entrenamiento == EntrenamientoFuerza.id_entrenamiento)
        .where(Entrenamiento.id_usuario == id_usuario)
        .options(*_opciones_sesion())
        .order_by(EntrenamientoFuerza.inicio_at.desc())
        .limit(limite)
    )
    if desde is not None:
        consulta = consulta.where(
            EntrenamientoFuerza.inicio_at >= datetime.combine(desde, datetime.min.time(), tzinfo=CHILE_TZ)
        )
    if hasta is not None:
        consulta = consulta.where(
            EntrenamientoFuerza.inicio_at
            < datetime.combine(hasta + timedelta(days=1), datetime.min.time(), tzinfo=CHILE_TZ)
        )
    return [_resumen(sesion) for sesion in (await db.scalars(consulta)).all()]


async def detalle_sesion(db: AsyncSession, id_usuario: int, id_entrenamiento_fuerza: int) -> SesionDetalle:
    sesion = await db.scalar(
        select(EntrenamientoFuerza)
        .join(Entrenamiento, Entrenamiento.id_entrenamiento == EntrenamientoFuerza.id_entrenamiento)
        .where(
            Entrenamiento.id_usuario == id_usuario,
            EntrenamientoFuerza.id_entrenamiento_fuerza == id_entrenamiento_fuerza,
        )
        .options(*_opciones_sesion())
    )
    if sesion is None:
        raise NoEncontrado("Sesion no encontrada.")
    series = [
        SerieDetalle(
            ejercicio=serie.ejercicio.nombre,
            id_ejercicio=serie.id_ejercicio,
            es_calentamiento=bool(serie.es_calentamiento),
            peso_kg=serie.cantidad_peso,
            por_mancuerna=es_con_mancuernas(serie.ejercicio.equipamiento),
            repeticiones=serie.repeticiones,
            repeticiones_negativas=serie.repeticiones_negativas,
        )
        for serie in sorted(sesion.series, key=lambda serie: serie.id_fuerza_detalle)
    ]
    return SesionDetalle(**_resumen(sesion).model_dump(), series=series)


async def progreso_ejercicio(
    db: AsyncSession,
    id_usuario: int,
    id_ejercicio: int,
    *,
    semanas: int = 12,
) -> ProgresoEjercicio:
    ejercicio = await db.get(Ejercicios, id_ejercicio)
    if ejercicio is None:
        raise NoEncontrado("Ejercicio no encontrado.")
    desde = datetime.now(CHILE_TZ) - timedelta(weeks=semanas)
    filas = (
        await db.execute(
            select(
                EntrenamientoFuerza.id_entrenamiento_fuerza,
                EntrenamientoFuerza.inicio_at,
                SerieFuerza.cantidad_peso,
                SerieFuerza.repeticiones,
            )
            .join(EntrenamientoFuerza, EntrenamientoFuerza.id_entrenamiento_fuerza == SerieFuerza.id_entrenamiento_fuerza)
            .join(Entrenamiento, Entrenamiento.id_entrenamiento == EntrenamientoFuerza.id_entrenamiento)
            .where(
                Entrenamiento.id_usuario == id_usuario,
                SerieFuerza.id_ejercicio == id_ejercicio,
                SerieFuerza.es_calentamiento.is_not(True),
                EntrenamientoFuerza.inicio_at >= desde,
            )
            .order_by(EntrenamientoFuerza.inicio_at, SerieFuerza.id_fuerza_detalle)
        )
    ).all()

    mancuernas = es_con_mancuernas(ejercicio.equipamiento)
    por_sesion: dict[int, list] = defaultdict(list)
    fechas: dict[int, date] = {}
    for id_sesion, inicio, peso, reps in filas:
        por_sesion[id_sesion].append((peso, reps))
        fechas[id_sesion] = inicio.astimezone(CHILE_TZ).date()

    sesiones = []
    for id_sesion, series in por_sesion.items():
        mejor_peso, mejor_reps = max(series, key=lambda serie: (serie[0], serie[1]))
        sesiones.append(
            ProgresoSesion(
                fecha=fechas[id_sesion],
                series_trabajo=len(series),
                mejor_peso_kg=mejor_peso,
                reps_con_mejor_peso=mejor_reps,
                rm_estimado_kg=round(max(rm_estimado(peso, reps) for peso, reps in series), 1),
                tonelaje=round(sum(peso * reps for peso, reps in series) * (2 if mancuernas else 1), 1),
            )
        )
    return ProgresoEjercicio(
        id_ejercicio=ejercicio.id_ejercicio,
        ejercicio=ejercicio.nombre,
        por_mancuerna=mancuernas,
        sesiones=sesiones,
    )


async def resumen_semanal(db: AsyncSession, id_usuario: int, *, semanas: int = 8) -> list[SemanaResumen]:
    hoy = datetime.now(CHILE_TZ).date()
    lunes_actual = hoy - timedelta(days=hoy.weekday())
    primer_lunes = lunes_actual - timedelta(weeks=semanas - 1)
    filas = (
        await db.execute(
            select(
                EntrenamientoFuerza.id_entrenamiento_fuerza,
                EntrenamientoFuerza.inicio_at,
                SerieFuerza.cantidad_peso,
                SerieFuerza.repeticiones,
                Ejercicios.equipamiento,
            )
            .join(EntrenamientoFuerza, EntrenamientoFuerza.id_entrenamiento_fuerza == SerieFuerza.id_entrenamiento_fuerza)
            .join(Entrenamiento, Entrenamiento.id_entrenamiento == EntrenamientoFuerza.id_entrenamiento)
            .join(Ejercicios, Ejercicios.id_ejercicio == SerieFuerza.id_ejercicio)
            .where(
                Entrenamiento.id_usuario == id_usuario,
                SerieFuerza.es_calentamiento.is_not(True),
                EntrenamientoFuerza.inicio_at
                >= datetime.combine(primer_lunes, datetime.min.time(), tzinfo=CHILE_TZ),
            )
        )
    ).all()

    resumen = {
        primer_lunes + timedelta(weeks=indice): {"sesiones": set(), "series": 0, "tonelaje": 0.0}
        for indice in range(semanas)
    }
    for id_sesion, inicio, peso, reps, equipamiento in filas:
        dia = inicio.astimezone(CHILE_TZ).date()
        semana = resumen.get(dia - timedelta(days=dia.weekday()))
        if semana is None:
            continue
        semana["sesiones"].add(id_sesion)
        semana["series"] += 1
        semana["tonelaje"] += peso * reps * (2 if es_con_mancuernas(equipamiento) else 1)

    return [
        SemanaResumen(
            lunes=lunes,
            sesiones=len(datos["sesiones"]),
            series_trabajo=datos["series"],
            tonelaje=round(datos["tonelaje"], 1),
        )
        for lunes, datos in resumen.items()
    ]


async def buscar_ejercicios(
    db: AsyncSession,
    texto: str,
    *,
    limite: int = 15,
) -> list[EjercicioBusqueda]:
    """Cada palabra tiene que aparecer en el nombre, el musculo o el equipamiento, sin
    importar tildes ni orden: "press banca" encuentra "Press de banca con barra"."""
    palabras = normalizar(texto).split()
    ejercicios = (
        await db.scalars(
            select(Ejercicios).options(
                selectinload(Ejercicios.subcategoria_musculo).selectinload(SubcategoriaMusculo.musculo)
            )
        )
    ).all()

    resultado = []
    for ejercicio in ejercicios:
        subcategoria = ejercicio.subcategoria_musculo
        musculo: Musculo | None = subcategoria.musculo if subcategoria else None
        campos = normalizar(
            " ".join(filter(None, (ejercicio.nombre, musculo and musculo.nombre, ejercicio.equipamiento)))
        )
        if all(palabra in campos for palabra in palabras):
            resultado.append(
                EjercicioBusqueda(
                    id_ejercicio=ejercicio.id_ejercicio,
                    nombre=ejercicio.nombre,
                    musculo=musculo.nombre if musculo else None,
                    subcategoria=subcategoria.nombre if subcategoria else None,
                    equipamiento=ejercicio.equipamiento,
                    musculos_secundarios=list(ejercicio.musculos_secundarios or []),
                )
            )
    # Los nombres cortos primero: "Press banca" antes que sus variantes largas.
    resultado.sort(key=lambda ejercicio: len(ejercicio.nombre))
    return resultado[:limite]
