"""Push que pide detallar la boleta de una compra recién pagada.

crear_movimiento deja un AvisoDetalleCompra cuando el gasto llega con recordar_detalle (solo
lo manda el Atajo de Wallet) en una categoría que pide detalle. El worker lo toma en su
siguiente vuelta, a lo más PUSH_WORKER_POLL_SECONDS después, y lo envía una sola vez.
"""
import logging
from datetime import timedelta

from sqlalchemy import exists, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AvisoDetalleCompra, CuentaUsuario, Movimiento, MovimientoItem, Usuario
from app.notifications.gastos import send_to_user_devices
from app.notifications.push import send_purchase_detail_push
from app.notifications.service import utc_now
from app.services.finanzas.semanal import formato_clp


logger = logging.getLogger("purchase-push")
# Si el worker estuvo caído, el aviso de una compra de hace horas ya no ayuda a nadie.
VIGENCIA = timedelta(hours=2)


async def claim_pending_purchase_alerts(db: AsyncSession) -> list[int]:
    """Marca como enviados los avisos pendientes y devuelve sus movimientos.

    Como en los recordatorios de gastos, el UPDATE ... RETURNING es atómico: cada aviso lo
    toma un solo worker, a cambio de no reintentar si el envío falla.
    """
    now = utc_now()
    result = await db.execute(
        update(AvisoDetalleCompra)
        .where(
            AvisoDetalleCompra.enviado_at.is_(None),
            AvisoDetalleCompra.created_at >= now - VIGENCIA,
        )
        .values(enviado_at=now)
        .returning(AvisoDetalleCompra.id_movimiento)
    )
    return list(result.scalars().all())


def purchase_alert_message(movimiento: Movimiento) -> tuple[str, str]:
    lugar = movimiento.comercio or movimiento.descripcion
    title = f"¿Detallas tu compra en {lugar}?" if lugar else "¿Detallas tu compra?"
    body = (
        f"Pagaste {formato_clp(movimiento.monto)}. Sácale una foto a la boleta y mándasela "
        "a Claude para registrar qué compraste."
    )
    return title, body


async def send_purchase_detail_alert(db: AsyncSession, id_movimiento: int) -> int:
    """Envía el aviso a cada dispositivo del dueño del gasto. Devuelve cuántos lo recibieron."""
    fila = (
        await db.execute(
            select(Movimiento, Usuario.auth_user_id)
            .join(CuentaUsuario, Movimiento.id_cuenta == CuentaUsuario.id_cuenta)
            .join(Usuario, CuentaUsuario.id_usuario == Usuario.id_usuario)
            .where(Movimiento.id_transaccion == id_movimiento)
        )
    ).one_or_none()
    if fila is None:
        return 0
    movimiento, auth_user_id = fila
    # Si alcanzó a detallarla antes de que saliera el aviso, no hay nada que recordar.
    if await db.scalar(select(exists().where(MovimientoItem.id_movimiento == id_movimiento))):
        return 0

    title, body = purchase_alert_message(movimiento)
    # La lambda resuelve send_purchase_detail_push al enviar: los tests lo reemplazan en el módulo.
    return await send_to_user_devices(
        db,
        auth_user_id,
        lambda subscription: send_purchase_detail_push(subscription, id_movimiento, title, body),
        "compras",
    )


async def process_purchase_detail_alerts(session_factory) -> None:
    async with session_factory() as db:
        async with db.begin():
            pendientes = await claim_pending_purchase_alerts(db)

    for id_movimiento in pendientes:
        try:
            async with session_factory() as db:
                await send_purchase_detail_alert(db, id_movimiento)
        except Exception:
            logger.exception("No se pudo avisar el detalle de la compra %s", id_movimiento)
