"""Gasto semanal, metas y presupuestos por categoría.

El gasto semanal es el "gasto del día a día": los gastos de lunes a domingo (calendario
de Chile) sin transferencias entre cuentas propias, sin abonos a deudas y sin las
categorías que el usuario excluyó (gastos fijos, pago de la tarjeta).
"""
from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


NivelAlerta = Literal["info", "aviso", "excedido"]


class GastoDiaSemana(BaseModel):
    fecha: date
    gasto_total: int = Field(..., examples=[18500])
    es_futuro: bool = False


class CategoriaSemana(BaseModel):
    id_categoria: int
    categoria: str
    total: int = Field(..., description="Gasto de la semana en la categoría.")
    total_semana_anterior: int = Field(
        ..., description="Gasto de la semana anterior, completa, en la misma categoría."
    )
    presupuesto_semanal: int | None = None
    porcentaje_presupuesto: float | None = Field(
        None, description="Gasto sobre el presupuesto, en %. Null sin presupuesto."
    )


class AlertaSemana(BaseModel):
    clave: str = Field(
        ...,
        description="Identifica la alerta dentro de su periodo, ej. '2026-10-12:semana:80'.",
        examples=["2026-10-12:semana:80"],
    )
    nivel: NivelAlerta
    titulo: str
    mensaje: str


class ResumenSemanalResponse(BaseModel):
    semana_inicio: date = Field(..., description="Lunes de la semana.")
    semana_fin: date = Field(..., description="Domingo de la semana.")
    es_semana_actual: bool
    dias_transcurridos: int = Field(..., ge=0, le=7, description="7 en semanas pasadas.")
    gasto_semana: int = Field(..., description="Gasto del día a día de la semana.")
    gasto_hoy: int | None = Field(None, description="Solo en la semana actual.")
    promedio_diario: float | None = Field(
        None, description="Gasto de la semana sobre los días transcurridos."
    )
    proyeccion_semana: float | None = Field(
        None, description="Promedio diario por 7. Solo en la semana actual."
    )
    meta_semanal: int | None = None
    restante: int | None = Field(None, description="Meta menos gasto. Negativo si se pasó.")
    porcentaje_meta: float | None = None
    disponible_hoy: int | None = Field(
        None,
        description=(
            "Cuánto se puede gastar hoy para cumplir la meta: lo que quedaba al empezar el "
            "día dividido por los días que faltan, hoy incluido. Solo en la semana actual."
        ),
    )
    gasto_semana_anterior: int = Field(..., description="La semana anterior completa.")
    gasto_semana_anterior_misma_altura: int = Field(
        ...,
        description=(
            "La semana anterior de lunes al mismo día de la semana que hoy: la comparación "
            "justa con una semana en curso. En semanas pasadas es la semana completa."
        ),
    )
    variacion_misma_altura: int
    variacion_misma_altura_pct: float | None = Field(
        None, description="Null si la semana anterior a la misma altura fue 0."
    )
    gasto_excluido: int = Field(
        ...,
        description="Gastos de la semana que no cuentan: abonos a deudas y categorías excluidas.",
    )
    dias: list[GastoDiaSemana]
    categorias: list[CategoriaSemana]
    alertas: list[AlertaSemana]

    model_config = ConfigDict(title="Resumen semanal de gasto")


class SemanaTendencia(BaseModel):
    semana_inicio: date
    semana_fin: date
    gasto_total: int
    meta_semanal: int | None = Field(None, description="La meta vigente hoy (no se guarda historial).")
    diferencia_meta: int | None = Field(
        None, description="Meta menos gasto: positivo es lo que se ahorró respecto a la meta."
    )
    es_semana_actual: bool = False


class TendenciaSemanalResponse(BaseModel):
    semanas: int
    meta_semanal: int | None
    promedio_semanas_completas: float | None = Field(
        None, description="Promedio de las semanas ya cerradas del rango."
    )
    ahorro_vs_meta_acumulado: int | None = Field(
        None, description="Suma de diferencia_meta de las semanas cerradas. Null sin meta."
    )
    semanas_cumplidas: int = Field(0, description="Semanas cerradas con gasto bajo la meta.")
    items: list[SemanaTendencia]

    model_config = ConfigDict(title="Tendencia semanal de gasto")


class CategoriaMeta(BaseModel):
    id_categoria: int
    nombre: str
    es_propia: bool
    excluida: bool = Field(..., description="Si queda fuera del gasto semanal.")
    presupuesto_semanal: int | None = None
    promedio_semanal: float = Field(
        ..., description="Gasto promedio de las últimas 4 semanas cerradas en la categoría."
    )


class MetasGastoResponse(BaseModel):
    meta_semanal: int | None
    sugerencia_semanal: int | None = Field(
        None,
        description="Promedio del gasto semanal de las últimas 4 semanas cerradas, redondeado.",
    )
    categorias: list[CategoriaMeta]


class CategoriaMetaUpdate(BaseModel):
    id_categoria: int = Field(..., ge=1)
    excluida: bool | None = None
    presupuesto_semanal: int | None = Field(
        None, gt=0, description="Null quita el presupuesto (solo si se envía el campo)."
    )


class MetasGastoUpdate(BaseModel):
    """Solo cambia lo enviado: meta_semanal null la quita; omitida, no la toca. Las
    categorías que no vienen en la lista quedan como estaban."""

    meta_semanal: int | None = Field(None, gt=0)
    categorias: list[CategoriaMetaUpdate] = Field(default_factory=list, max_length=200)
