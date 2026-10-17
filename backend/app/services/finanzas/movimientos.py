from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    CategoriaFinanza,
    CuentaUsuario,
    Movimiento,
    MovimientoItem,
    Producto,
    Usuario,
)
from app.models.finanzas import EnumTipoMovimiento
from app.schemas.finanzas import MovimientoCreate, MovimientoPatch
from app.services.catalogo import productos
from app.services.errores import Conflicto, NoEncontrado
from app.services.finanzas import categorias, deudas


CHILE_TZ = ZoneInfo("America/Santiago")


def _opciones_detalle() -> tuple:
    """Relaciones que necesita MovimientoResponse (categoria, cuenta, deuda y productos)."""
    return (
        selectinload(Movimiento.categoria),
        selectinload(Movimiento.cuenta),
        selectinload(Movimiento.deuda),
        selectinload(Movimiento.items)
        .selectinload(MovimientoItem.producto)
        .selectinload(Producto.marca),
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
    year: int | None = None,
    month: int | None = None,
    tipo_movimiento: EnumTipoMovimiento | None = None,
    id_categoria: int | None = None,
    id_cuenta: int | None = None,
    q: str | None = None,
    id_deuda: int | None = None,
    fecha_desde: date | None = None,
    fecha_hasta: date | None = None,
    origen: str | None = None,
    estado: str | None = None,
) -> list:
    """Condiciones WHERE del listado. Un mes sin año usa el año actual de Chile. El rango
    fecha_desde/fecha_hasta incluye ambos días (fecha de operación)."""
    filtros = []
    if fecha_desde is not None:
        filtros.append(Movimiento.created_at >= datetime.combine(fecha_desde, datetime.min.time()))
    if fecha_hasta is not None:
        filtros.append(Movimiento.created_at < datetime.combine(fecha_hasta + timedelta(days=1), datetime.min.time()))
    if origen == "manual":
        filtros.append(Movimiento.id_importacion.is_(None))
    elif origen == "importado":
        filtros.append(Movimiento.id_importacion.is_not(None))
    if estado == "pendiente":
        filtros.append(Movimiento.fecha_contable.is_(None))
    elif estado == "conciliado":
        filtros.append(Movimiento.fecha_contable.is_not(None))
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
    if id_deuda is not None:
        filtros.append(Movimiento.id_deuda == id_deuda)
    if q:
        patron = f"%{q.strip()}%"
        filtros.append(or_(
            Movimiento.descripcion.ilike(patron),
            Movimiento.descripcion_original.ilike(patron),
            CategoriaFinanza.nombre.ilike(patron),
        ))
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


def _consulta_listado(usuario: Usuario, columnas, filtros: dict):
    consulta = (
        select(columnas)
        .join(CuentaUsuario, Movimiento.id_cuenta == CuentaUsuario.id_cuenta)
        .where(CuentaUsuario.id_usuario == usuario.id_usuario, *filtros_listado_movimientos(**filtros))
    )
    if filtros.get("q"):
        consulta = consulta.join(CategoriaFinanza, Movimiento.id_categoria == CategoriaFinanza.id_categoria)
    return consulta


async def contar_movimientos(db: AsyncSession, usuario: Usuario, **filtros) -> int:
    """Total de movimientos con los mismos filtros de ``listar_movimientos``."""
    return await db.scalar(_consulta_listado(usuario, func.count(Movimiento.id_transaccion), filtros))


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
    id_deuda: int | None = None,
    fecha_desde: date | None = None,
    fecha_hasta: date | None = None,
    origen: str | None = None,
    estado: str | None = None,
) -> list[Movimiento]:
    """Movimientos del usuario, más recientes primero. Sin resultados es una lista vacía."""
    filtros = dict(
        year=year,
        month=month,
        tipo_movimiento=tipo_movimiento,
        id_categoria=id_categoria,
        id_cuenta=id_cuenta,
        q=q,
        id_deuda=id_deuda,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        origen=origen,
        estado=estado,
    )
    consulta = _consulta_listado(usuario, Movimiento, filtros).execution_options(populate_existing=True)

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
            Movimiento.id_transferencia.is_(None),
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


async def validar_categoria(db: AsyncSession, usuario: Usuario, id_categoria: int) -> None:
    """La categoría debe ser por defecto o del usuario, y no estar archivada."""
    categoria = await categorias.obtener_categoria(db, usuario, id_categoria)
    if not categoria.activo:
        raise Conflicto(f"La categoría «{categoria.nombre}» está archivada.")


async def validar_cuenta_activa(db: AsyncSession, usuario: Usuario, id_cuenta: int) -> None:
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

    await validar_categoria(db, usuario, data.id_categoria)
    await validar_cuenta_activa(db, usuario, data.id_cuenta)
    for item in data.items:
        await validar_producto_activo(db, usuario, item.id_producto)
    if data.id_deuda is not None:
        await deudas.validar_abono(
            db, usuario, data.id_deuda, tipo_movimiento=data.tipo_movimiento, monto=data.monto
        )

    movimiento = Movimiento(
        **data.model_dump(exclude_none=True, exclude={"items"})
    )

    db.add(movimiento)
    await db.flush()
    # Los productos se crean en la misma transaccion: o queda el gasto con su detalle,
    # o no queda nada.
    for item in data.items:
        db.add(MovimientoItem(id_movimiento=movimiento.id_transaccion, **item.model_dump()))
    if data.items:
        await db.flush()
    return await _recargar_con_detalle(db, movimiento.id_transaccion)


async def validar_producto_activo(db: AsyncSession, usuario: Usuario, id_producto: int) -> None:
    """El producto debe ser visible para el usuario y seguir en el catalogo."""
    producto = await productos.obtener_producto(db, usuario, id_producto)
    if not producto.activo:
        raise Conflicto(f"El producto «{producto.nombre_producto}» fue dado de baja del catálogo.")


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

    # Mantener la categoría que ya tenía es válido aunque después se haya archivado.
    if "id_categoria" in update_data and update_data["id_categoria"] != movimiento.id_categoria:
        await validar_categoria(db, usuario, update_data["id_categoria"])
    if "id_cuenta" in update_data:
        await validar_cuenta_activa(db, usuario, update_data["id_cuenta"])
    if update_data.get("tipo_movimiento") == EnumTipoMovimiento.INGRESO:
        tiene_items = await db.scalar(
            select(MovimientoItem.id_item).where(MovimientoItem.id_movimiento == movimiento.id_transaccion).limit(1)
        )
        if tiene_items is not None:
            raise Conflicto("Quita los productos del gasto antes de convertirlo en ingreso.")

    # El abono resultante debe seguir siendo válido: cambiar de deuda, de tipo o subir el
    # monto puede romper el tipo esperado o superar el saldo.
    id_deuda = update_data.get("id_deuda", movimiento.id_deuda)
    if id_deuda is not None and any(campo in update_data for campo in ("id_deuda", "tipo_movimiento", "monto")):
        await deudas.validar_abono(
            db,
            usuario,
            id_deuda,
            tipo_movimiento=update_data.get("tipo_movimiento", movimiento.tipo_movimiento),
            monto=update_data.get("monto", movimiento.monto),
            excluir_movimiento=movimiento.id_transaccion,
        )

    aplicar_patch_movimiento(movimiento, update_data)

    await db.commit()

    return await _recargar_con_detalle(db, id_movimiento)


async def eliminar_movimiento(db: AsyncSession, usuario: Usuario, id_movimiento: int) -> int | None:
    """Borra el movimiento. Si es parte de una transferencia borra también su espejo (sin
    él quedaría plata que sale de una cuenta y no llega a ninguna) y devuelve su id."""
    movimiento = await db.scalar(
        select(Movimiento)
        .join(CuentaUsuario, Movimiento.id_cuenta == CuentaUsuario.id_cuenta)
        .where(
            Movimiento.id_transaccion == id_movimiento,
            CuentaUsuario.id_usuario == usuario.id_usuario,
        )
    )
    if not movimiento:
        raise NoEncontrado("Movimiento no encontrado.")

    id_espejo = None
    if movimiento.id_transferencia is not None:
        espejo = await db.scalar(
            select(Movimiento).where(
                Movimiento.id_transferencia == movimiento.id_transferencia,
                Movimiento.id_transaccion != movimiento.id_transaccion,
            )
        )
        if espejo is not None:
            id_espejo = espejo.id_transaccion
            await db.delete(espejo)

    # Sus productos detallados se borran en cascada (ON DELETE CASCADE).
    await db.delete(movimiento)
    await db.commit()
    return id_espejo
