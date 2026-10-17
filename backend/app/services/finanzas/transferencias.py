"""Transferencias entre cuentas propias (traspasos, pagos de tarjeta de crédito).

Una transferencia son dos movimientos espejo unidos por ``id_transferencia``: un gasto en
la cuenta de origen y un ingreso en la de destino, por el mismo monto. Mueven el saldo de
ambas cuentas pero la analítica los excluye: no son gasto ni ingreso de verdad (el gasto
real de una tarjeta son sus compras, no su pago).
"""
import uuid
from datetime import date, datetime, timedelta

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CategoriaFinanza, Movimiento, Usuario
from app.models.finanzas import EnumTipoGasto, EnumTipoMovimiento
from app.services.errores import Conflicto, DatosInvalidos
from app.services.finanzas import movimientos
from app.services.finanzas.cuentas import FECHA_SALDO


NOMBRE_CATEGORIA = "Transferencias"
# Entre que sale de una cuenta y entra a la otra pueden pasar un fin de semana y un feriado.
VENTANA_ESPEJO = timedelta(days=4)


def opuesto(tipo: EnumTipoMovimiento) -> EnumTipoMovimiento:
    return EnumTipoMovimiento.INGRESO if tipo == EnumTipoMovimiento.GASTO else EnumTipoMovimiento.GASTO


async def categoria_transferencias(db: AsyncSession) -> int:
    """Categoría por defecto de las transferencias (la crea una migración)."""
    id_categoria = await db.scalar(
        select(CategoriaFinanza.id_categoria).where(
            CategoriaFinanza.id_usuario.is_(None),
            func.lower(CategoriaFinanza.nombre) == NOMBRE_CATEGORIA.lower(),
        )
    )
    if id_categoria is None:
        raise Conflicto(f"Falta la categoría por defecto «{NOMBRE_CATEGORIA}».")
    return id_categoria


async def validar_cuentas(db: AsyncSession, usuario: Usuario, id_cuenta: int, id_contraparte: int) -> None:
    if id_cuenta == id_contraparte:
        raise DatosInvalidos("Una transferencia necesita dos cuentas distintas.")
    await movimientos.validar_cuenta_activa(db, usuario, id_contraparte)


async def buscar_espejo(
    db: AsyncSession,
    *,
    id_cuenta: int,
    tipo_movimiento: EnumTipoMovimiento,
    monto: int,
    fecha: date,
    excluir: set[int] = frozenset(),
) -> Movimiento | None:
    """Movimiento de ``id_cuenta`` que ya refleja una transferencia: mismo tipo y monto,
    sin transferencia y a ``VENTANA_ESPEJO`` días o menos. El más cercano en fecha."""
    candidatos = (
        await db.execute(
            select(Movimiento, FECHA_SALDO).where(
                Movimiento.id_cuenta == id_cuenta,
                Movimiento.tipo_movimiento == tipo_movimiento,
                Movimiento.monto == monto,
                Movimiento.id_transferencia.is_(None),
                FECHA_SALDO >= fecha - VENTANA_ESPEJO,
                FECHA_SALDO <= fecha + VENTANA_ESPEJO,
            )
        )
    ).all()
    opciones = [
        (abs((dia - fecha).days), movimiento.id_transaccion, movimiento)
        for movimiento, dia in candidatos
        if movimiento.id_transaccion not in excluir
    ]
    return min(opciones, key=lambda opcion: opcion[:2])[2] if opciones else None


def crear_espejo(movimiento: Movimiento, id_cuenta: int, *, id_importacion: int | None = None) -> Movimiento:
    """Contraparte de ``movimiento`` en ``id_cuenta``. Queda pendiente de conciliar: la
    fecha contable la pondrá la cartola de esa cuenta."""
    return Movimiento(
        id_cuenta=id_cuenta,
        id_categoria=movimiento.id_categoria,
        id_importacion=id_importacion,
        id_transferencia=movimiento.id_transferencia,
        tipo_movimiento=opuesto(movimiento.tipo_movimiento),
        tipo_gasto=EnumTipoGasto.VARIABLE,
        monto=movimiento.monto,
        descripcion=movimiento.descripcion,
        en_lugar_compra=False,
        created_at=movimiento.created_at,
        hora_conocida=movimiento.hora_conocida,
    )


async def crear_transferencia(
    db: AsyncSession,
    usuario: Usuario,
    *,
    id_cuenta_origen: int,
    id_cuenta_destino: int,
    monto: int,
    fecha: datetime | None = None,
    hora_conocida: bool = True,
    descripcion: str | None = None,
    client_request_id: uuid.UUID | None = None,
) -> tuple[Movimiento, Movimiento]:
    """Crea el gasto en el origen y el ingreso en el destino. Devuelve (origen, destino)."""
    if client_request_id is not None:
        existente = await db.scalar(select(Movimiento).where(Movimiento.client_request_id == client_request_id))
        if existente is not None:
            origen = await movimientos.obtener_movimiento(db, usuario, existente.id_transaccion)
            espejo = await db.scalar(
                select(Movimiento.id_transaccion).where(
                    Movimiento.id_transferencia == origen.id_transferencia,
                    Movimiento.id_transaccion != origen.id_transaccion,
                )
            )
            if origen.id_transferencia is None or espejo is None:
                raise Conflicto("El identificador de la solicitud ya fue utilizado.")
            return origen, await movimientos.obtener_movimiento(db, usuario, espejo)

    await movimientos.validar_cuenta_activa(db, usuario, id_cuenta_origen)
    await validar_cuentas(db, usuario, id_cuenta_origen, id_cuenta_destino)

    origen = Movimiento(
        client_request_id=client_request_id,
        id_cuenta=id_cuenta_origen,
        id_categoria=await categoria_transferencias(db),
        id_transferencia=uuid.uuid4(),
        tipo_movimiento=EnumTipoMovimiento.GASTO,
        tipo_gasto=EnumTipoGasto.VARIABLE,
        monto=monto,
        descripcion=descripcion,
        en_lugar_compra=False,
        created_at=fecha or datetime.now(movimientos.CHILE_TZ).replace(tzinfo=None),
        hora_conocida=hora_conocida,
    )
    destino = crear_espejo(origen, id_cuenta_destino)
    db.add_all([origen, destino])
    await db.flush()
    return (
        await movimientos.obtener_movimiento(db, usuario, origen.id_transaccion),
        await movimientos.obtener_movimiento(db, usuario, destino.id_transaccion),
    )


async def desvincular_huerfanas(db: AsyncSession, ids_transferencia: set[uuid.UUID]) -> None:
    """Un movimiento cuyo espejo ya no existe vuelve a ser un gasto o ingreso común."""
    if not ids_transferencia:
        return
    vigentes = (
        select(Movimiento.id_transferencia)
        .where(Movimiento.id_transferencia.in_(ids_transferencia))
        .group_by(Movimiento.id_transferencia)
        .having(func.count() > 1)
    )
    await db.execute(
        update(Movimiento)
        .where(Movimiento.id_transferencia.in_(ids_transferencia), Movimiento.id_transferencia.not_in(vigentes))
        .values(id_transferencia=None)
    )
