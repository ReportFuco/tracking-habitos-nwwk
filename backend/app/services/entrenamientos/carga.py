"""Carga por zona muscular en un periodo: lo que pinta el mapa del cuerpo.

La unidad son las *series efectivas*: cada serie de trabajo (no de calentamiento) suma 1
a la zona del musculo principal del ejercicio y 0,5 a cada zona de sus musculos
secundarios. Es la convencion habitual para contar volumen semanal por musculo, y la que
usan los rangos de referencia (10 a 20 series por semana para hipertrofia).

El tonelaje (kg x repeticiones) se suma solo a la zona principal; con mancuernas el peso
se anota por mancuerna, asi que cuenta doble.
"""
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Ejercicios,
    Entrenamiento,
    EntrenamientoFuerza,
    Musculo,
    SerieFuerza,
    SubcategoriaMusculo,
)
from app.services.entrenamientos.texto import normalizar


CHILE_TZ = ZoneInfo("America/Santiago")

# Zonas del mapa del cuerpo, en el orden en que se listan.
ZONAS: dict[str, str] = {
    "pecho": "Pecho",
    "hombro": "Hombros",
    "bicep": "Bíceps",
    "tricep": "Tríceps",
    "antebrazo": "Antebrazos",
    "abdomen": "Abdomen",
    "serrato": "Serrato",
    "trapecio": "Trapecio",
    "dorsal": "Dorsales",
    "lumbar": "Zona lumbar",
    "gluteo": "Glúteos",
    "cuadricep": "Cuádriceps",
    "femoral": "Femorales",
    "aductor": "Aductores",
    "abductor": "Abductores",
    "pantorrilla": "Pantorrillas",
    "cuello": "Cuello",
}

# Musculo principal (codigo del catalogo) -> zona. Espalda se reparte por subcategoria.
_ZONA_PRINCIPAL = {codigo: codigo for codigo in ZONAS if codigo in {
    "pecho", "hombro", "bicep", "tricep", "antebrazo", "abdomen", "serrato", "cuadricep",
    "aductor", "abductor", "femoral", "gluteo", "pantorrilla", "cuello",
}}
_ZONA_ESPALDA = {"trapecio": "trapecio", "espalda_baja": "lumbar"}

# Musculos secundarios del catalogo (texto libre, normalizado) -> zona. Los que no
# aparecen (tobillos, pies, flexores de cadera...) no tienen zona en el mapa.
_ZONA_SECUNDARIA = {
    "hombros": "hombro",
    "deltoides": "hombro",
    "rear deltoids": "hombro",
    "manguito rotador": "hombro",
    "femorales": "femoral",
    "antebrazos": "antebrazo",
    "munecas": "antebrazo",
    "extensores de muneca": "antebrazo",
    "flexores de muneca": "antebrazo",
    "grip muscles": "antebrazo",
    "manos": "antebrazo",
    "triceps": "tricep",
    "biceps": "bicep",
    "brachialis": "bicep",
    "cuadriceps": "cuadricep",
    "gemelos": "pantorrilla",
    "soleo": "pantorrilla",
    "gluteos": "gluteo",
    "core": "abdomen",
    "oblicuos": "abdomen",
    "abdominales": "abdomen",
    "lower abs": "abdomen",
    "pecho": "pecho",
    "upper chest": "pecho",
    "trapecio": "trapecio",
    "romboides": "dorsal",
    "espalda alta": "dorsal",
    "espalda": "dorsal",
    "dorsales": "dorsal",
    "espalda baja": "lumbar",
    "aductores": "aductor",
    "inner thighs": "aductor",
    "sternocleidomastoid": "cuello",
}

PESO_SECUNDARIO = 0.5

# Series efectivas por semana -> nivel. Por debajo de 4 apenas estimula; entre 10 y 20
# es el rango habitual para crecer; sobre 20 se acumula fatiga sin mucho beneficio extra.
# (tope exclusivo, nivel); lo que pasa del ultimo tope es "alto".
NIVELES = ((4.0, "bajo"), (10.0, "moderado"), (20.0, "optimo"))
NIVEL_ALTO = "alto"


def nivel_de(series: float) -> str:
    if series <= 0:
        return "sin_trabajo"
    for tope, nivel in NIVELES:
        if series < tope:
            return nivel
    # 20 justas todavia es el rango optimo.
    return "optimo" if series == NIVELES[-1][0] else NIVEL_ALTO


def zona_principal(codigo_musculo: str | None, codigo_subcategoria: str | None) -> str | None:
    if codigo_musculo == "espalda":
        return _ZONA_ESPALDA.get(codigo_subcategoria or "", "dorsal")
    return _ZONA_PRINCIPAL.get(codigo_musculo or "")


def zonas_secundarias(secundarios: list[str] | None, principal: str | None) -> set[str]:
    zonas = {_ZONA_SECUNDARIA.get(normalizar(nombre)) for nombre in secundarios or ()}
    zonas.discard(None)
    zonas.discard(principal)
    return zonas  # type: ignore[return-value]


def es_con_mancuernas(equipamiento: str | None) -> bool:
    return "mancuerna" in normalizar(equipamiento)


@dataclass
class Periodo:
    modo: str
    desde: datetime
    hasta: datetime

    @property
    def etiqueta(self) -> str:
        if self.modo == "7d":
            return "Últimos 7 días"
        fin = (self.hasta - timedelta(days=1)).date()
        return f"Semana del {self.desde.date():%d-%m} al {fin:%d-%m}"


def periodo_movil(ahora: datetime | None = None) -> Periodo:
    """Los 7 dias que terminan ahora: acumulado continuo, sin reinicio los lunes."""
    hasta = ahora or datetime.now(CHILE_TZ)
    return Periodo(modo="7d", desde=hasta - timedelta(days=7), hasta=hasta)


def periodo_semana(fecha: date | None = None) -> Periodo:
    """Semana calendario de lunes a domingo (hora de Chile) que contiene `fecha`."""
    dia = fecha or datetime.now(CHILE_TZ).date()
    lunes = dia - timedelta(days=dia.weekday())
    desde = datetime.combine(lunes, time.min, tzinfo=CHILE_TZ)
    return Periodo(modo="semana", desde=desde, hasta=desde + timedelta(days=7))


@dataclass
class CargaZona:
    codigo: str
    nombre: str
    series: float = 0.0
    directas: int = 0
    indirectas: int = 0
    tonelaje: float = 0.0
    ultima_vez: datetime | None = None
    ejercicios: set[str] = field(default_factory=set)

    @property
    def nivel(self) -> str:
        return nivel_de(self.series)


@dataclass
class CargaMuscular:
    periodo: Periodo
    sesiones: int
    series_trabajo: int
    zonas: list[CargaZona]


async def calcular_carga(db: AsyncSession, id_usuario: int, periodo: Periodo) -> CargaMuscular:
    filas = (
        await db.execute(
            select(
                EntrenamientoFuerza.id_entrenamiento_fuerza,
                EntrenamientoFuerza.inicio_at,
                SerieFuerza.cantidad_peso,
                SerieFuerza.repeticiones,
                Ejercicios.nombre,
                Ejercicios.equipamiento,
                Ejercicios.musculos_secundarios,
                Musculo.codigo,
                SubcategoriaMusculo.codigo,
            )
            .join(EntrenamientoFuerza, EntrenamientoFuerza.id_entrenamiento_fuerza == SerieFuerza.id_entrenamiento_fuerza)
            .join(Entrenamiento, Entrenamiento.id_entrenamiento == EntrenamientoFuerza.id_entrenamiento)
            .join(Ejercicios, Ejercicios.id_ejercicio == SerieFuerza.id_ejercicio)
            .join(SubcategoriaMusculo, SubcategoriaMusculo.id_subcategoria_musculo == Ejercicios.id_subcategoria_musculo)
            .join(Musculo, Musculo.id_musculo == SubcategoriaMusculo.id_musculo)
            .where(
                Entrenamiento.id_usuario == id_usuario,
                SerieFuerza.es_calentamiento.is_not(True),
                EntrenamientoFuerza.inicio_at >= periodo.desde,
                EntrenamientoFuerza.inicio_at < periodo.hasta,
            )
        )
    ).all()

    zonas = {codigo: CargaZona(codigo=codigo, nombre=nombre) for codigo, nombre in ZONAS.items()}
    sesiones: set[int] = set()

    for id_sesion, inicio, peso, reps, ejercicio, equipamiento, secundarios, musculo, subcategoria in filas:
        sesiones.add(id_sesion)
        principal = zona_principal(musculo, subcategoria)
        if principal is not None:
            zona = zonas[principal]
            zona.series += 1
            zona.directas += 1
            zona.tonelaje += (peso or 0) * (reps or 0) * (2 if es_con_mancuernas(equipamiento) else 1)
            zona.ejercicios.add(ejercicio)
            zona.ultima_vez = max(filter(None, (zona.ultima_vez, inicio)))
        for codigo in zonas_secundarias(secundarios, principal):
            zona = zonas[codigo]
            zona.series += PESO_SECUNDARIO
            zona.indirectas += 1
            zona.ultima_vez = max(filter(None, (zona.ultima_vez, inicio)))

    return CargaMuscular(
        periodo=periodo,
        sesiones=len(sesiones),
        series_trabajo=len(filas),
        zonas=list(zonas.values()),
    )
