"""Respuestas de analisis de entrenamiento: carga muscular, sesiones, progreso y las notas
de seguimiento que deja la IA. Las comparten la API REST y el servidor MCP."""
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.services.entrenamientos.carga import CargaMuscular


TipoSeguimiento = Literal["seguimiento", "sugerencia", "alerta", "plan"]
NivelCarga = Literal["sin_trabajo", "bajo", "moderado", "optimo", "alto"]


class ZonaCargaResponse(BaseModel):
    codigo: str
    nombre: str
    series: float = Field(description="Series efectivas: 1 por serie directa, 0,5 por indirecta.")
    directas: int = Field(description="Series de trabajo con esta zona como musculo principal.")
    indirectas: int = Field(description="Series donde la zona trabajo como musculo secundario.")
    tonelaje: float = Field(description="kg x repeticiones de las series directas (mancuernas x2).")
    nivel: NivelCarga
    ultima_vez: datetime | None
    ejercicios: list[str]


class CargaMuscularResponse(BaseModel):
    modo: Literal["7d", "semana"]
    etiqueta: str
    desde: datetime
    hasta: datetime
    sesiones: int
    series_trabajo: int
    zonas: list[ZonaCargaResponse]

    @classmethod
    def desde_carga(cls, carga: CargaMuscular) -> "CargaMuscularResponse":
        return cls(
            modo=carga.periodo.modo,
            etiqueta=carga.periodo.etiqueta,
            desde=carga.periodo.desde,
            hasta=carga.periodo.hasta,
            sesiones=carga.sesiones,
            series_trabajo=carga.series_trabajo,
            zonas=[
                ZonaCargaResponse(
                    codigo=zona.codigo,
                    nombre=zona.nombre,
                    series=round(zona.series, 1),
                    directas=zona.directas,
                    indirectas=zona.indirectas,
                    tonelaje=round(zona.tonelaje, 1),
                    nivel=zona.nivel,
                    ultima_vez=zona.ultima_vez,
                    ejercicios=sorted(zona.ejercicios),
                )
                for zona in carga.zonas
            ],
        )


class SeguimientoResponse(BaseModel):
    id_seguimiento: int
    tipo: TipoSeguimiento
    titulo: str
    contenido: str
    zonas: list[str] = Field(default_factory=list)
    origen: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_validator("zonas", mode="before")
    @classmethod
    def sin_zonas_es_lista_vacia(cls, valor):
        return valor or []


class SeguimientosResponse(BaseModel):
    seguimientos: list[SeguimientoResponse]


class SerieDetalle(BaseModel):
    ejercicio: str
    id_ejercicio: int
    es_calentamiento: bool
    peso_kg: float = Field(description="Por mancuerna si por_mancuerna es true.")
    por_mancuerna: bool
    repeticiones: int
    repeticiones_negativas: int


class SesionResumen(BaseModel):
    id_entrenamiento_fuerza: int
    inicio: datetime
    fin: datetime | None
    duracion_minutos: int | None
    estado: str
    gimnasio: str | None
    series_trabajo: int
    series_calentamiento: int
    ejercicios: list[str]
    zonas: list[str] = Field(description="Zonas trabajadas como musculo principal.")


class SesionesResponse(BaseModel):
    sesiones: list[SesionResumen]


class SesionDetalle(SesionResumen):
    series: list[SerieDetalle]


class ProgresoSesion(BaseModel):
    fecha: date
    series_trabajo: int
    mejor_peso_kg: float
    reps_con_mejor_peso: int
    rm_estimado_kg: float = Field(description="1RM estimado (Epley) de la mejor serie.")
    tonelaje: float


class ProgresoEjercicio(BaseModel):
    id_ejercicio: int
    ejercicio: str
    por_mancuerna: bool
    sesiones: list[ProgresoSesion]


class SemanaResumen(BaseModel):
    lunes: date
    sesiones: int
    series_trabajo: int
    tonelaje: float


class ResumenSemanal(BaseModel):
    semanas: list[SemanaResumen]


class EjercicioBusqueda(BaseModel):
    id_ejercicio: int
    nombre: str
    musculo: str | None
    subcategoria: str | None
    equipamiento: str | None
    musculos_secundarios: list[str]


class EjerciciosBusqueda(BaseModel):
    ejercicios: list[EjercicioBusqueda]
