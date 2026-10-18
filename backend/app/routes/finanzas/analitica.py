from datetime import date

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.fastapi_users import current_user_or_api_key
from app.db import get_db
from app.models.finanzas import EnumTipoMovimiento
from app.routes.finanzas._http import obtener_usuario_actual
from app.schemas.finanzas import (
    AnaliticaDiariaResponse,
    AnaliticaDistribucionCategoriasResponse,
    AnaliticaDistribucionCuentasResponse,
    AnaliticaResumenResponse,
    AnaliticaTendenciaMensualResponse,
    ResumenSemanalResponse,
    TendenciaSemanalResponse,
)
from app.services.finanzas import analitica as servicio
from app.services.finanzas import semanal
# Reexportado: los tests unitarios lo importan desde este modulo.
from app.services.finanzas.analitica import agrupar_por_dia  # noqa: F401


router = APIRouter(prefix="/analitica", tags=["Finanzas · Analitica"])


@router.get(
    "/resumen",
    summary="Resumen financiero del periodo",
    response_model=AnaliticaResumenResponse,
    status_code=status.HTTP_200_OK,
)
async def obtener_resumen_financiero(
    year: int | None = Query(default=None, ge=2000, le=2100),
    month: int | None = Query(default=None, ge=1, le=12),
    user=Depends(current_user_or_api_key),
    db: AsyncSession = Depends(get_db),
):
    usuario = await obtener_usuario_actual(user, db)
    return await servicio.resumen_financiero(db, usuario, year, month)


@router.get(
    "/tendencia-mensual",
    summary="Tendencia mensual de movimientos",
    response_model=AnaliticaTendenciaMensualResponse,
    status_code=status.HTTP_200_OK,
)
async def obtener_tendencia_mensual(
    months: int = Query(default=6, ge=1, le=24),
    user=Depends(current_user_or_api_key),
    db: AsyncSession = Depends(get_db),
):
    usuario = await obtener_usuario_actual(user, db)
    return await servicio.tendencia_mensual(db, usuario, months)


@router.get(
    "/distribucion-categorias",
    summary="Distribucion de montos por categoria",
    response_model=AnaliticaDistribucionCategoriasResponse,
    status_code=status.HTTP_200_OK,
)
async def obtener_distribucion_categorias(
    year: int | None = Query(default=None, ge=2000, le=2100),
    month: int | None = Query(default=None, ge=1, le=12),
    tipo_movimiento: EnumTipoMovimiento = Query(default=EnumTipoMovimiento.GASTO),
    user=Depends(current_user_or_api_key),
    db: AsyncSession = Depends(get_db),
):
    usuario = await obtener_usuario_actual(user, db)
    return await servicio.distribucion_categorias(db, usuario, year, month, tipo_movimiento)


@router.get(
    "/distribucion-cuentas",
    summary="Distribucion de montos por cuenta",
    response_model=AnaliticaDistribucionCuentasResponse,
    status_code=status.HTTP_200_OK,
)
async def obtener_distribucion_cuentas(
    year: int | None = Query(default=None, ge=2000, le=2100),
    month: int | None = Query(default=None, ge=1, le=12),
    tipo_movimiento: EnumTipoMovimiento = Query(default=EnumTipoMovimiento.GASTO),
    user=Depends(current_user_or_api_key),
    db: AsyncSession = Depends(get_db),
):
    usuario = await obtener_usuario_actual(user, db)
    return await servicio.distribucion_cuentas(db, usuario, year, month, tipo_movimiento)


@router.get(
    "/diaria",
    summary="Gasto e ingreso por dia del mes",
    response_model=AnaliticaDiariaResponse,
    status_code=status.HTTP_200_OK,
)
async def obtener_analitica_diaria(
    year: int | None = Query(default=None, ge=2000, le=2100),
    month: int | None = Query(default=None, ge=1, le=12),
    user=Depends(current_user_or_api_key),
    db: AsyncSession = Depends(get_db),
):
    usuario = await obtener_usuario_actual(user, db)
    return await servicio.analitica_diaria(db, usuario, year, month)


@router.get(
    "/semanal",
    summary="Gasto semanal contra la meta",
    description=(
        "Gasto del día a día de la semana (lunes a domingo, hora de Chile) que contiene "
        "`fecha` (hoy si se omite): sin transferencias, abonos a deudas ni categorías "
        "excluidas. Incluye la meta, el tope de hoy, la comparación con la semana anterior a "
        "la misma altura, los presupuestos por categoría y las alertas vigentes."
    ),
    response_model=ResumenSemanalResponse,
    status_code=status.HTTP_200_OK,
)
async def obtener_resumen_semanal(
    fecha: date | None = Query(default=None, description="Cualquier día de la semana a consultar."),
    user=Depends(current_user_or_api_key),
    db: AsyncSession = Depends(get_db),
):
    usuario = await obtener_usuario_actual(user, db)
    return await semanal.resumen_semanal(db, usuario, fecha)


@router.get(
    "/semanas",
    summary="Gasto de las ultimas semanas",
    response_model=TendenciaSemanalResponse,
    status_code=status.HTTP_200_OK,
)
async def obtener_tendencia_semanal(
    semanas: int = Query(default=8, ge=1, le=52),
    user=Depends(current_user_or_api_key),
    db: AsyncSession = Depends(get_db),
):
    usuario = await obtener_usuario_actual(user, db)
    return await semanal.tendencia_semanal(db, usuario, semanas)
