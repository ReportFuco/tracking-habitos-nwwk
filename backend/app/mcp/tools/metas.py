"""Herramientas MCP del gasto semanal: resumen de la semana, tendencia y metas de gasto.

El gasto semanal es el "gasto del día a día" (lunes a domingo): sin transferencias, sin
abonos a deudas y sin las categorías que el usuario excluyó. Ver services.finanzas.semanal.
"""
from datetime import date
from typing import Annotated

from mcp.server.mcpserver import Context
from pydantic import Field

from app.auth.scopes import FINANZAS_WRITE
from app.mcp.tools.finanzas import MODIFICA, SOLO_LECTURA, _validar, sesion_usuario
from app.schemas.finanzas import (
    CategoriaMetaUpdate,
    MetasGastoResponse,
    MetasGastoUpdate,
    ResumenSemanalResponse,
    TendenciaSemanalResponse,
)
from app.services.finanzas import semanal


async def resumen_semanal(
    ctx: Context,
    fecha: Annotated[
        date | None,
        Field(description="Cualquier día de la semana a consultar. Si se omite, la semana actual."),
    ] = None,
) -> ResumenSemanalResponse:
    """Gasto del día a día de una semana (lunes a domingo) contra la meta semanal.

    Trae lo gastado, lo que queda, el tope de hoy (disponible_hoy, que reparte lo que queda
    entre los días que faltan), el promedio diario, la proyección al domingo, la
    comparación con la semana anterior a la misma altura (lunes a hoy contra lunes al mismo
    día), el gasto por categoría con su presupuesto, cuánto quedó fuera (gasto_excluido:
    deudas y categorías excluidas) y las alertas vigentes. Úsala para "cómo voy esta
    semana" en vez de resumen_mes, que incluye pagos grandes como deudas.
    """
    async with sesion_usuario(ctx) as (db, usuario):
        return await semanal.resumen_semanal(db, usuario, fecha)


async def tendencia_semanal(
    ctx: Context,
    semanas: Annotated[int, Field(ge=1, le=52, description="Semanas hacia atrás, la actual incluida.")] = 8,
) -> TendenciaSemanalResponse:
    """Gasto del día a día de las últimas N semanas contra la meta vigente: diferencia
    con la meta por semana (positivo = ahorro), semanas cumplidas, promedio y ahorro
    acumulado de las semanas cerradas."""
    async with sesion_usuario(ctx) as (db, usuario):
        return await semanal.tendencia_semanal(db, usuario, semanas)


async def ver_metas_gasto(ctx: Context) -> MetasGastoResponse:
    """Meta semanal, sugerencia (promedio de las últimas 4 semanas) y, por categoría, si
    cuenta en el gasto semanal, su presupuesto y su promedio semanal."""
    async with sesion_usuario(ctx) as (db, usuario):
        return await semanal.obtener_metas(db, usuario)


async def fijar_metas_gasto(
    ctx: Context,
    meta_semanal: Annotated[
        int | None,
        Field(gt=0, description="Meta de gasto semanal en CLP. Omítela para no cambiarla."),
    ] = None,
    quitar_meta: Annotated[bool, Field(description="true para quitar la meta semanal.")] = False,
    categorias: Annotated[
        list[CategoriaMetaUpdate] | None,
        Field(
            description=(
                "Categorías a cambiar: excluida (true = no cuenta en el gasto semanal, para "
                "gastos fijos) y/o presupuesto_semanal (null lo quita). Las demás no cambian."
            ),
        ),
    ] = None,
) -> MetasGastoResponse:
    """Fija la meta semanal y la configuración de categorías. Confirma los montos con el
    usuario antes de fijarlos; puedes proponer la sugerencia de ver_metas_gasto."""
    datos: dict = {"categorias": categorias or []}
    if quitar_meta:
        datos["meta_semanal"] = None
    elif meta_semanal is not None:
        datos["meta_semanal"] = meta_semanal
    data = _validar(MetasGastoUpdate, **datos)
    async with sesion_usuario(ctx, FINANZAS_WRITE) as (db, usuario):
        return await semanal.actualizar_metas(db, usuario, data)


HERRAMIENTAS = (
    (resumen_semanal, "Resumen semanal de gasto", SOLO_LECTURA),
    (tendencia_semanal, "Tendencia semanal de gasto", SOLO_LECTURA),
    (ver_metas_gasto, "Ver metas de gasto", SOLO_LECTURA),
    (fijar_metas_gasto, "Fijar metas de gasto", MODIFICA),
)
