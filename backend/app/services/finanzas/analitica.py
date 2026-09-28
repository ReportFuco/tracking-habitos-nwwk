from calendar import monthrange
from datetime import date, datetime
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import CuentaUsuario, Movimiento, Usuario
from app.models.finanzas import EnumTipoGasto, EnumTipoMovimiento
from app.schemas.finanzas import (
    AnaliticaDiariaItem,
    AnaliticaDiariaResponse,
    AnaliticaDistribucionCategoriaItem,
    AnaliticaDistribucionCategoriasResponse,
    AnaliticaDistribucionCuentaItem,
    AnaliticaDistribucionCuentasResponse,
    AnaliticaResumenResponse,
    AnaliticaTendenciaMensualItem,
    AnaliticaTendenciaMensualResponse,
)


CHILE_TZ = ZoneInfo("America/Santiago")


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


async def resumen_financiero(
    db: AsyncSession,
    usuario: Usuario,
    year: int | None = None,
    month: int | None = None,
) -> AnaliticaResumenResponse:
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


async def tendencia_mensual(
    db: AsyncSession,
    usuario: Usuario,
    months: int = 6,
) -> AnaliticaTendenciaMensualResponse:
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


async def distribucion_categorias(
    db: AsyncSession,
    usuario: Usuario,
    year: int | None = None,
    month: int | None = None,
    tipo_movimiento: EnumTipoMovimiento = EnumTipoMovimiento.GASTO,
) -> AnaliticaDistribucionCategoriasResponse:
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


async def distribucion_cuentas(
    db: AsyncSession,
    usuario: Usuario,
    year: int | None = None,
    month: int | None = None,
    tipo_movimiento: EnumTipoMovimiento = EnumTipoMovimiento.GASTO,
) -> AnaliticaDistribucionCuentasResponse:
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


def agrupar_por_dia(movimientos, year: int, month: int, hoy: date) -> AnaliticaDiariaResponse:
    """Totales por dia del mes. Puro: recibe los movimientos ya filtrados al periodo."""
    dias_mes = monthrange(year, month)[1]
    es_mes_actual = (hoy.year, hoy.month) == (year, month)
    if es_mes_actual:
        dias_transcurridos = hoy.day
    elif (year, month) < (hoy.year, hoy.month):
        dias_transcurridos = dias_mes
    else:
        dias_transcurridos = 0

    gasto = [0.0] * (dias_mes + 1)
    ingreso = [0.0] * (dias_mes + 1)
    cantidad = [0] * (dias_mes + 1)
    for mov in movimientos:
        dia = mov.created_at.day
        cantidad[dia] += 1
        if mov.tipo_movimiento == EnumTipoMovimiento.GASTO:
            gasto[dia] += float(mov.monto)
        else:
            ingreso[dia] += float(mov.monto)

    items = [
        AnaliticaDiariaItem(
            dia=dia,
            fecha=date(year, month, dia),
            gasto_total=gasto[dia],
            ingreso_total=ingreso[dia],
            cantidad_movimientos=cantidad[dia],
            es_futuro=es_mes_actual and dia > hoy.day,
        )
        for dia in range(1, dias_mes + 1)
    ]
    gasto_total = sum(gasto)
    con_gasto = [item for item in items if item.gasto_total > 0]
    return AnaliticaDiariaResponse(
        year=year,
        month=month,
        dias_mes=dias_mes,
        dias_transcurridos=dias_transcurridos,
        gasto_total=gasto_total,
        promedio_gasto_diario=gasto_total / dias_transcurridos if dias_transcurridos else None,
        dia_mayor_gasto=max(con_gasto, key=lambda item: item.gasto_total) if con_gasto else None,
        items=items,
    )


async def analitica_diaria(
    db: AsyncSession,
    usuario: Usuario,
    year: int | None = None,
    month: int | None = None,
) -> AnaliticaDiariaResponse:
    resolved_year, resolved_month, period_start, period_end = _resolve_period(year, month)
    movimientos = await _get_movimientos_periodo(
        db=db,
        id_usuario=usuario.id_usuario,
        start=period_start,
        end=period_end,
    )
    return agrupar_por_dia(movimientos, resolved_year, resolved_month, _get_chile_now().date())
