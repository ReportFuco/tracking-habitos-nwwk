"""Recordatorio diario para registrar los gastos del dia."""

import asyncio
import logging
from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from pywebpush import WebPushException
from sqlalchemy import exists, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    CuentaUsuario,
    Movimiento,
    NotificationPreference,
    PushSubscription,
    Usuario,
)
from app.models.finanzas import EnumTipoMovimiento
from app.notifications.push import send_expense_push
from app.notifications.service import utc_now


logger = logging.getLogger("expense-push")
CHILE_TZ = ZoneInfo("America/Santiago")


def chile_now() -> datetime:
    return datetime.now(CHILE_TZ)


def mark_today_if_time_passed(
    preference: NotificationPreference,
    now: datetime,
) -> None:
    """Al activar o mover la hora, si ya paso hoy no se avisa hasta mañana.

    Sin esto, quien activa el aviso de las 21:00 a las 23:00 lo recibiria al instante.
    """
    if now.time() >= preference.expense_reminder_time:
        preference.expense_reminder_last_on = now.date()


async def claim_due_expense_reminders(db: AsyncSession, now: datetime) -> list[int]:
    """Marca como procesado hoy a cada usuario cuya hora ya llego y devuelve sus ids.

    El UPDATE ... RETURNING es atomico: si hubiera dos workers, cada usuario lo toma uno
    solo. A cambio el aviso es "como mucho uno al dia": si el envio falla no se reintenta.
    """
    today = now.date()
    result = await db.execute(
        update(NotificationPreference)
        .where(
            NotificationPreference.expense_reminders_enabled.is_(True),
            NotificationPreference.expense_reminder_time <= now.time().replace(tzinfo=None),
            or_(
                NotificationPreference.expense_reminder_last_on.is_(None),
                NotificationPreference.expense_reminder_last_on < today,
            ),
        )
        .values(expense_reminder_last_on=today)
        .returning(NotificationPreference.auth_user_id)
    )
    return list(result.scalars().all())


async def registered_expense_on(db: AsyncSession, auth_user_id: int, day: date) -> bool:
    # created_at es naive y esta en calendario de Chile.
    start = datetime.combine(day, time.min)
    return bool(
        await db.scalar(
            select(
                exists().where(
                    Movimiento.id_cuenta == CuentaUsuario.id_cuenta,
                    CuentaUsuario.id_usuario == Usuario.id_usuario,
                    Usuario.auth_user_id == auth_user_id,
                    Movimiento.tipo_movimiento == EnumTipoMovimiento.GASTO,
                    Movimiento.created_at >= start,
                )
            )
        )
    )


async def send_expense_reminder(db: AsyncSession, auth_user_id: int) -> int:
    """Envia el aviso a cada dispositivo activo del usuario. Devuelve cuantos lo recibieron."""
    subscriptions = (
        await db.scalars(
            select(PushSubscription).where(
                PushSubscription.auth_user_id == auth_user_id,
                PushSubscription.enabled.is_(True),
            )
        )
    ).all()

    sent = 0
    for subscription in subscriptions:
        now = utc_now()
        subscription.updated_at = now
        try:
            await asyncio.to_thread(send_expense_push, subscription)
        except WebPushException as exc:
            status_code = getattr(exc.response, "status_code", None)
            subscription.failure_count += 1
            if status_code in {404, 410}:
                # El navegador revoco la suscripcion: no tiene sentido volver a intentarlo.
                subscription.enabled = False
                subscription.disabled_at = now
            else:
                logger.warning("Push de gastos fallo (%s): %s", status_code, exc)
        except Exception:
            subscription.failure_count += 1
            logger.exception("Push de gastos fallo")
        else:
            sent += 1
            subscription.failure_count = 0
            subscription.last_success_at = now
    await db.commit()
    return sent


async def process_expense_reminders(session_factory) -> None:
    now = chile_now()
    async with session_factory() as db:
        async with db.begin():
            due = await claim_due_expense_reminders(db, now)

    for auth_user_id in due:
        async with session_factory() as db:
            if await registered_expense_on(db, auth_user_id, now.date()):
                continue
            await send_expense_reminder(db, auth_user_id)
