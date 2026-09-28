from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    CategoriaFinanza,
    Compra,
    CuentaUsuario,
    Local,
    Movimiento,
    MovimientoCompra,
    Usuario,
)
from app.models.finanzas import EnumTipoMovimiento
from app.schemas.finanzas import MovimientoCreate, MovimientoPatch
from app.services.errores import Conflicto, NoEncontrado


CHILE_TZ = ZoneInfo("America/Santiago")


def _opciones_detalle() -> tuple:
    """Relaciones que necesita MovimientoResponse (categoria, cuenta y compras vinculadas)."""
    return (
        selectinload(Movimiento.categoria),
        selectinload(Movimiento.cuenta),
        selectinload(Movimiento.vinculos_compra)
        .selectinload(MovimientoCompra.compra)
        .selectinload(Compra.local)
        .selectinload(Local.cadena),
        selectinload(Movimiento.vinculos_compra)
        .selectinload(MovimientoCompra.compra)
        .selectinload(Compra.detalles),
    )


async def _recargar_con_detalle(db: AsyncSession, id_transaccion: int) -> Movimiento:
    return await db.scalar(
        select(Movimiento)
        .execution_options(populate_existing=True)
        .where(Movimiento.id_transaccion == id_transaccion)
        .options(*_opciones_detalle())
    )


def rango_mes(year: int, month: int) -> tuple[datetime, datetime]:
    """Inicio y fin (naive, calendario de Chile) de un mes. created_at es naive."""
    inicio = datetime(year, month, 1)
    fin = datetime(year + 1, 1, 1) if month == 12 else datetime(year, month + 1, 1)
    return inicio, fin


def filtros_listado_movimientos(
    *,
    year: int | None,
    month: int | None,
    tipo_movimiento: EnumTipoMovimiento | None,
    id_categoria: int | None,
    id_cuenta: int | None,
    q: str | None,
) -> list:
    """Condiciones WHERE del listado. Un mes sin año usa el año actual de Chile."""
    filtros = []
    if month is not None:
        anio = year or datetime.now(CHILE_TZ).year
        inicio, fin = rango_mes(anio, month)
        filtros += [Movimiento.created_at >= inicio, Movimiento.created_at < fin]
    elif year is not None:
        filtros += [
            Movimiento.created_at >= datetime(year, 1, 1),
            Movimiento.created_at < datetime(year + 1, 1, 1),
        ]
    if tipo_movimiento is not None:
        filtros.append(Movimiento.tipo_movimiento == tipo_movimiento)
    if id_categoria is not None:
        filtros.append(Movimiento.id_categoria == id_categoria)
    if id_cuenta is not None:
        filtros.append(Movimiento.id_cuenta == id_cuenta)
    if q:
        patron = f"%{q.strip()}%"
        filtros.append(or_(Movimiento.descripcion.ilike(patron), CategoriaFinanza.nombre.ilike(patron)))
    return filtros


def aplicar_patch_movimiento(movimiento: Movimiento, update_data: dict) -> None:
    """Aplica un PATCH validado manteniendo las invariantes del modelo.

    La ubicación del lugar de compra solo existe en gastos
    (``ck_movimiento_ubicacion_solo_gasto``). Si un gasto presencial pasa a ser
    ingreso, la ubicación deja de tener sentido y se descarta; como el PATCH no permite
    editar la ubicación, rechazarlo impediría corregir el tipo del movimiento.
    """
    for field, value in update_data.items():
        setattr(movimiento, field, value)

    if movimiento.tipo_movimiento != EnumTipoMovimiento.GASTO and movimiento.en_lugar_compra:
        movimiento.en_lugar_compra = False
        movimiento.latitud = None
        movimiento.longitud = None
        movimiento.precision_ubicacion = None


def _get_current_chile_month_range() -> tuple[datetime, datetime]:
    now_chile = datetime.now(CHILE_TZ)
    month_start = now_chile.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    if month_start.month == 12:
        next_month = month_start.replace(year=month_start.year + 1, month=1)
    else:
        next_month = month_start.replace(month=month_start.month + 1)

    # La columna created_at usa DateTime sin timezone; por eso comparamos con
    # valores naive construidos desde el calendario de Chile.
    return month_start.replace(tzinfo=None), next_month.replace(tzinfo=None)


async def listar_movimientos(
    db: AsyncSession,
    usuario: Usuario,
    *,
    offset: int = 0,
    limit: int = 20,
    year: int | None = None,
    month: int | None = None,
    tipo_movimiento: EnumTipoMovimiento | None = None,
    id_categoria: int | None = None,
    id_cuenta: int | None = None,
    q: str | None = None,
) -> list[Movimiento]:
    """Movimientos del usuario, más recientes primero. Sin resultados es una lista vacía."""
    filtros = filtros_listado_movimientos(
        year=year,
        month=month,
        tipo_movimiento=tipo_movimiento,
        id_categoria=id_categoria,
        id_cuenta=id_cuenta,
        q=q,
    )

    consulta = (
        select(Movimiento)
        .execution_options(populate_existing=True)
        .join(CuentaUsuario, Movimiento.id_cuenta == CuentaUsuario.id_cuenta)
        .where(CuentaUsuario.id_usuario == usuario.id_usuario, *filtros)
    )
    if q:
        consulta = consulta.join(CategoriaFinanza, Movimiento.id_categoria == CategoriaFinanza.id_categoria)

    return (
        await db.execute(
            consulta
            .order_by(desc(Movimiento.created_at), desc(Movimiento.id_transaccion))
            .offset(offset)
            .limit(limit)
            .options(*_opciones_detalle())
        )
    ).scalars().all()


async def gasto_mes_actual(db: AsyncSession, usuario: Usuario) -> float:
    """Suma de gastos del mes en curso, calendario de Chile."""
    rango_inicio, rango_fin = _get_current_chile_month_range()
    total = await db.scalar(
        select(func.coalesce(func.sum(Movimiento.monto), 0))
        .join(CuentaUsuario, Movimiento.id_cuenta == CuentaUsuario.id_cuenta)
        .where(
            CuentaUsuario.id_usuario == usuario.id_usuario,
            Movimiento.tipo_movimiento == EnumTipoMovimiento.GASTO,
            Movimiento.created_at >= rango_inicio,
            Movimiento.created_at < rango_fin,
        )
    )
    return float(total or 0)


async def obtener_movimiento(db: AsyncSession, usuario: Usuario, id_movimiento: int) -> Movimiento:
    transaccion = await db.scalar(
        select(Movimiento)
        .execution_options(populate_existing=True)
        .join(CuentaUsuario, Movimiento.id_cuenta == CuentaUsuario.id_cuenta)
        .where(
            and_(
                Movimiento.id_transaccion == id_movimiento,
                CuentaUsuario.id_usuario == usuario.id_usuario
            )
        )
        .options(*_opciones_detalle())
    )
    if not transaccion:
        raise NoEncontrado("Movimiento no encontrado.")
    return transaccion


async def _validar_categoria(db: AsyncSession, id_categoria: int) -> None:
    categoria = await db.scalar(
        select(CategoriaFinanza).where(CategoriaFinanza.id_categoria == id_categoria)
    )
    if not categoria:
        raise NoEncontrado("Categoría no encontrada.")


async def _validar_cuenta_activa(db: AsyncSession, usuario: Usuario, id_cuenta: int) -> None:
    cuenta = await db.scalar(
        select(CuentaUsuario).where(
            CuentaUsuario.id_cuenta == id_cuenta,
            CuentaUsuario.activo.is_(True),
            CuentaUsuario.id_usuario == usuario.id_usuario
        )
    )
    if not cuenta:
        raise NoEncontrado("Cuenta no encontrada.")


async def crear_movimiento(db: AsyncSession, usuario: Usuario, data: MovimientoCreate) -> Movimiento:
    # La cola offline puede reenviar la misma solicitud si la respuesta se pierde. El
    # identificador del cliente convierte ese reintento en una lectura del movimiento ya
    # creado, evitando duplicar el gasto.
    if data.client_request_id is not None:
        movimiento_existente = await db.scalar(
            select(Movimiento)
            .where(Movimiento.client_request_id == data.client_request_id)
            .options(*_opciones_detalle())
        )
        if movimiento_existente is not None:
            if movimiento_existente.cuenta.id_usuario != usuario.id_usuario:
                raise Conflicto("El identificador de la solicitud ya fue utilizado.")
            return movimiento_existente

    await _validar_categoria(db, data.id_categoria)
    await _validar_cuenta_activa(db, usuario, data.id_cuenta)

    movimiento = Movimiento(
        **data.model_dump(exclude_none=True)
    )

    db.add(movimiento)
    await db.flush()
    await db.refresh(
        movimiento,
        attribute_names=["categoria", "cuenta", "vinculos_compra"]
    )

    return await _recargar_con_detalle(db, movimiento.id_transaccion)


async def editar_movimiento(
    db: AsyncSession,
    usuario: Usuario,
    id_movimiento: int,
    data: MovimientoPatch,
) -> Movimiento:
    movimiento = await db.scalar(
        select(Movimiento)
        .join(CuentaUsuario, Movimiento.id_cuenta == CuentaUsuario.id_cuenta)
        .where(
            Movimiento.id_transaccion == id_movimiento,
            CuentaUsuario.id_usuario == usuario.id_usuario
        )
    )
    if not movimiento:
        raise NoEncontrado("Movimiento no encontrado.")

    update_data = data.model_dump(exclude_unset=True)

    if "id_categoria" in update_data:
        await _validar_categoria(db, update_data["id_categoria"])
    if "id_cuenta" in update_data:
        await _validar_cuenta_activa(db, usuario, update_data["id_cuenta"])

    aplicar_patch_movimiento(movimiento, update_data)

    await db.commit()

    await db.refresh(
        movimiento,
        attribute_names=["categoria", "cuenta", "vinculos_compra"]
    )

    return await _recargar_con_detalle(db, id_movimiento)


async def eliminar_movimiento(db: AsyncSession, usuario: Usuario, id_movimiento: int) -> None:
    movimiento = await db.scalar(
        select(Movimiento)
        .join(CuentaUsuario, Movimiento.id_cuenta == CuentaUsuario.id_cuenta)
        .where(
            Movimiento.id_transaccion == id_movimiento,
            CuentaUsuario.id_usuario == usuario.id_usuario,
        )
        .options(selectinload(Movimiento.vinculos_compra))
    )
    if not movimiento:
        raise NoEncontrado("Movimiento no encontrado.")

    # Los vinculos con compras se borran en cascada; las compras quedan intactas.
    await db.delete(movimiento)
    await db.commit()
