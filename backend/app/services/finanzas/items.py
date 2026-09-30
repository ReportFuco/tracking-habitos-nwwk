"""Productos detallados dentro de un gasto.

Cada operación devuelve el movimiento completo: quien edita el detalle casi siempre quiere
ver cómo quedó el total detallado frente al monto.
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CuentaUsuario, Movimiento, MovimientoItem, Usuario
from app.models.finanzas import EnumTipoMovimiento
from app.schemas.finanzas import MovimientoItemCreate, MovimientoItemPatch
from app.services.errores import Conflicto, NoEncontrado
from app.services.finanzas import movimientos


async def _gasto_del_usuario(db: AsyncSession, usuario: Usuario, id_movimiento: int) -> Movimiento:
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
    if movimiento.tipo_movimiento != EnumTipoMovimiento.GASTO:
        raise Conflicto("Solo los gastos pueden detallar productos.")
    return movimiento


async def _item_del_movimiento(db: AsyncSession, id_movimiento: int, id_item: int) -> MovimientoItem:
    item = await db.scalar(
        select(MovimientoItem).where(
            MovimientoItem.id_item == id_item,
            MovimientoItem.id_movimiento == id_movimiento,
        )
    )
    if not item:
        raise NoEncontrado("Producto del gasto no encontrado.")
    return item


async def agregar_item(
    db: AsyncSession,
    usuario: Usuario,
    id_movimiento: int,
    data: MovimientoItemCreate,
) -> Movimiento:
    movimiento = await _gasto_del_usuario(db, usuario, id_movimiento)
    await movimientos.validar_producto_activo(db, usuario, data.id_producto)

    db.add(MovimientoItem(id_movimiento=movimiento.id_transaccion, **data.model_dump()))
    await db.flush()
    return await movimientos.obtener_movimiento(db, usuario, id_movimiento)


async def editar_item(
    db: AsyncSession,
    usuario: Usuario,
    id_movimiento: int,
    id_item: int,
    data: MovimientoItemPatch,
) -> Movimiento:
    await _gasto_del_usuario(db, usuario, id_movimiento)
    item = await _item_del_movimiento(db, id_movimiento, id_item)

    cambios = data.model_dump(exclude_unset=True)
    if "id_producto" in cambios and cambios["id_producto"] != item.id_producto:
        await movimientos.validar_producto_activo(db, usuario, cambios["id_producto"])
    for field, value in cambios.items():
        setattr(item, field, value)

    await db.flush()
    return await movimientos.obtener_movimiento(db, usuario, id_movimiento)


async def eliminar_item(db: AsyncSession, usuario: Usuario, id_movimiento: int, id_item: int) -> Movimiento:
    await _gasto_del_usuario(db, usuario, id_movimiento)
    item = await _item_del_movimiento(db, id_movimiento, id_item)
    await db.delete(item)
    await db.flush()
    return await movimientos.obtener_movimiento(db, usuario, id_movimiento)
