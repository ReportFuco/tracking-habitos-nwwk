from calendar import monthrange
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.fastapi_users import current_user_or_api_key
from app.db import get_db
from app.models import CuentaUsuario, Movimiento, Usuario
from app.models.finanzas import EnumTipoGasto, EnumTipoMovimiento
from app.schemas.finanzas import (
    AnaliticaDistribucionCategoriaItem,
    AnaliticaDistribucionCategoriasResponse,
    AnaliticaDistribucionCuentaItem,
    AnaliticaDistribucionCuentasResponse,
    AnaliticaResumenResponse,
    AnaliticaTendenciaMensualItem,
    AnaliticaTendenciaMensualResponse,
)
from zoneinfo import ZoneInfo


router = APIRouter(prefix="/analitica", tags=["Finanzas · Analitica"])
CHILE_TZ = ZoneInfo("America/Santiago")


async def obtener_usuario_actual(user, db: AsyncSession) -> Usuario:
    usuario = await db.scalar(
        select(Usuario).where(Usuario.auth_user_id == user.id)
    )
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Perfil de usuario no encontrado."
        )
    return usuario


def _get_chile_now() -> datetime:
    return datetime.now(CHILE_TZ)


def _month_start(year: int, month: int) -> datetime:
    return datetime(year, month, 1)


def _next_month_start(year: int, month: int) -> datetime:
    if month == 12:
        return datetime(year + 1, 1, 1)
    return datetime(year, month + 1, 1)


def _previous_month(year: int, month: int) -> tuple[int, int]:
    if month == 1:
        return year - 1, 12
    return year, month - 1


def _resolve_period(year: int | None, month: int | None) -> tuple[int, int, datetime, datetime]:
    now_chile = _get_chile_now()
    resolved_year = year or now_chile.year
    resolved_month = month or now_chile.month

    start = _month_start(resolved_year, resolved_month)
    end = _next_month_start(resolved_year, resolved_month)

    return resolved_year, resolved_month, start, end


def _month_sequence(months: int, end_year: int, end_month: int) -> list[tuple[int, int]]:
    sequence: list[tuple[int, int]] = []
    current_year = end_year
    current_month = end_month

    for _ in range(months):
        sequence.append((current_year, current_month))
        current_year, current_month = _previous_month(current_year, current_month)

    sequence.reverse()
    return sequence


async def _get_movimientos_periodo(
    db: AsyncSession,
    id_usuario: int,
    start: datetime,
    end: datetime,
    tipo_movimiento: EnumTipoMovimiento | None = None,
) -> list[Movimiento]:
    stmt = (
        select(Movimiento)
        .join(CuentaUsuario, Movimiento.id_cuenta == CuentaUsuario.id_cuenta)
        .where(
            CuentaUsuario.id_usuario == id_usuario,
            Movimiento.created_at >= start,
            Movimiento.created_at < end,
        )
        .options(
            selectinload(Movimiento.categoria),
            selectinload(Movimiento.cuenta),
        )
    )

    if tipo_movimiento is not None:
        stmt = stmt.where(Movimiento.tipo_movimiento == tipo_movimiento)

    return (await db.execute(stmt)).scalars().all()


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
    now_chile = _get_chile_now()
    resolved_year, resolved_month, period_start, period_end = _resolve_period(year, month)

    previous_year, previous_month = _previous_month(resolved_year, resolved_month)
    previous_start = _month_start(previous_year, previous_month)
    previous_end = _next_month_start(previous_year, previous_month)

    movimientos = await _get_movimientos_periodo(
        db=db,
        id_usuario=usuario.id_usuario,
        start=period_start,
        end=period_end,
    )
    movimientos_previos = await _get_movimientos_periodo(
        db=db,
        id_usuario=usuario.id_usuario,
        start=previous_start,
        end=previous_end,
        tipo_movimiento=EnumTipoMovimiento.GASTO,
    )

    gastos = [mov for mov in movimientos if mov.tipo_movimiento == EnumTipoMovimiento.GASTO]
    ingresos = [mov for mov in movimientos if mov.tipo_movimiento == EnumTipoMovimiento.INGRESO]

    gasto_total = float(sum(mov.monto for mov in gastos))
    ingreso_total = float(sum(mov.monto for mov in ingresos))
    balance_total = ingreso_total - gasto_total
    gasto_fijo_total = float(
        sum(mov.monto for mov in gastos if mov.tipo_gasto == EnumTipoGasto.FIJO)
    )
    gasto_variable_total = float(
        sum(mov.monto for mov in gastos if mov.tipo_gasto == EnumTipoGasto.VARIABLE)
    )
    ticket_promedio_gasto = float(gasto_total / len(gastos)) if gastos else 0.0
    gasto_mayor = float(max((mov.monto for mov in gastos), default=0))
    gasto_mes_anterior = float(sum(mov.monto for mov in movimientos_previos))
    variacion_gasto = gasto_total - gasto_mes_anterior
    variacion_gasto_pct = None
    if gasto_mes_anterior > 0:
        variacion_gasto_pct = float((variacion_gasto / gasto_mes_anterior) * 100)

    tasa_ahorro_pct = None
    if ingreso_total > 0:
        tasa_ahorro_pct = float((balance_total / ingreso_total) * 100)

    proyeccion_gasto = None
    if resolved_year == now_chile.year and resolved_month == now_chile.month:
        dias_transcurridos = max(now_chile.day, 1)
        dias_mes = monthrange(resolved_year, resolved_month)[1]
        proyeccion_gasto = float((gasto_total / dias_transcurridos) * dias_mes)

    return AnaliticaResumenResponse(
        year=resolved_year,
        month=resolved_month,
        period_start=period_start,
        period_end=period_end,
        gasto_total=gasto_total,
        ingreso_total=ingreso_total,
        balance_total=balance_total,
        gasto_fijo_total=gasto_fijo_total,
        gasto_variable_total=gasto_variable_total,
        cantidad_movimientos=len(movimientos),
        ticket_promedio_gasto=ticket_promedio_gasto,
        gasto_mayor=gasto_mayor,
        tasa_ahorro_pct=tasa_ahorro_pct,
        variacion_gasto_vs_mes_anterior=variacion_gasto,
        variacion_gasto_vs_mes_anterior_pct=variacion_gasto_pct,
        proyeccion_gasto_fin_mes=proyeccion_gasto,
    )


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
    now_chile = _get_chile_now()

    sequence = _month_sequence(months, now_chile.year, now_chile.month)
    first_year, first_month = sequence[0]
    first_start = _month_start(first_year, first_month)
    range_end = _next_month_start(now_chile.year, now_chile.month)

    movimientos = await _get_movimientos_periodo(
        db=db,
        id_usuario=usuario.id_usuario,
        start=first_start,
        end=range_end,
    )

    aggregates: dict[tuple[int, int], dict[str, float | int]] = {
        (year, month): {
            "gasto_total": 0.0,
            "ingreso_total": 0.0,
            "cantidad_movimientos": 0,
        }
        for year, month in sequence
    }

    for movimiento in movimientos:
        key = (movimiento.created_at.year, movimiento.created_at.month)
        if key not in aggregates:
            continue

        aggregates[key]["cantidad_movimientos"] += 1
        if movimiento.tipo_movimiento == EnumTipoMovimiento.GASTO:
            aggregates[key]["gasto_total"] += float(movimiento.monto)
        elif movimiento.tipo_movimiento == EnumTipoMovimiento.INGRESO:
            aggregates[key]["ingreso_total"] += float(movimiento.monto)

    items = [
        AnaliticaTendenciaMensualItem(
            year=year,
            month=month,
            label=f"{year}-{month:02d}",
            gasto_total=float(aggregates[(year, month)]["gasto_total"]),
            ingreso_total=float(aggregates[(year, month)]["ingreso_total"]),
            balance_total=float(
                aggregates[(year, month)]["ingreso_total"] - aggregates[(year, month)]["gasto_total"]
            ),
            cantidad_movimientos=int(aggregates[(year, month)]["cantidad_movimientos"]),
        )
        for year, month in sequence
    ]

    return AnaliticaTendenciaMensualResponse(months=months, items=items)


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
    resolved_year, resolved_month, period_start, period_end = _resolve_period(year, month)
    movimientos = await _get_movimientos_periodo(
        db=db,
        id_usuario=usuario.id_usuario,
        start=period_start,
        end=period_end,
        tipo_movimiento=tipo_movimiento,
    )

    total_periodo = float(sum(mov.monto for mov in movimientos))
    aggregates: dict[int, dict[str, float | int | str]] = {}

    for movimiento in movimientos:
        categoria = movimiento.categoria.nombre if movimiento.categoria else "Sin categoria"
        if movimiento.id_categoria not in aggregates:
            aggregates[movimiento.id_categoria] = {
                "categoria": categoria,
                "total": 0.0,
                "cantidad_movimientos": 0,
            }

        aggregates[movimiento.id_categoria]["total"] += float(movimiento.monto)
        aggregates[movimiento.id_categoria]["cantidad_movimientos"] += 1

    items = [
        AnaliticaDistribucionCategoriaItem(
            id_categoria=id_categoria,
            categoria=str(data["categoria"]),
            total=float(data["total"]),
            cantidad_movimientos=int(data["cantidad_movimientos"]),
            porcentaje_del_total=float((data["total"] / total_periodo) * 100) if total_periodo > 0 else 0.0,
        )
        for id_categoria, data in sorted(
            aggregates.items(),
            key=lambda item: item[1]["total"],
            reverse=True,
        )
    ]

    return AnaliticaDistribucionCategoriasResponse(
        year=resolved_year,
        month=resolved_month,
        tipo_movimiento=tipo_movimiento,
        total_periodo=total_periodo,
        items=items,
    )


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
    resolved_year, resolved_month, period_start, period_end = _resolve_period(year, month)
    movimientos = await _get_movimientos_periodo(
        db=db,
        id_usuario=usuario.id_usuario,
        start=period_start,
        end=period_end,
        tipo_movimiento=tipo_movimiento,
    )

    total_periodo = float(sum(mov.monto for mov in movimientos))
    aggregates: dict[int, dict[str, float | int | str]] = {}

    for movimiento in movimientos:
        nombre_cuenta = movimiento.cuenta.nombre_cuenta if movimiento.cuenta else "Cuenta sin nombre"
        if movimiento.id_cuenta not in aggregates:
            aggregates[movimiento.id_cuenta] = {
                "nombre_cuenta": nombre_cuenta,
                "total": 0.0,
                "cantidad_movimientos": 0,
            }

        aggregates[movimiento.id_cuenta]["total"] += float(movimiento.monto)
        aggregates[movimiento.id_cuenta]["cantidad_movimientos"] += 1

    items = [
        AnaliticaDistribucionCuentaItem(
            id_cuenta=id_cuenta,
            nombre_cuenta=str(data["nombre_cuenta"]),
            total=float(data["total"]),
            cantidad_movimientos=int(data["cantidad_movimientos"]),
            porcentaje_del_total=float((data["total"] / total_periodo) * 100) if total_periodo > 0 else 0.0,
        )
        for id_cuenta, data in sorted(
            aggregates.items(),
            key=lambda item: item[1]["total"],
            reverse=True,
        )
    ]

    return AnaliticaDistribucionCuentasResponse(
        year=resolved_year,
        month=resolved_month,
        tipo_movimiento=tipo_movimiento,
        total_periodo=total_periodo,
        items=items,
    )
