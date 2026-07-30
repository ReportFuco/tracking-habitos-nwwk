import asyncio
import logging
from datetime import timedelta

from pywebpush import WebPushException
from sqlalchemy import select, update

from app.db.session import AsyncSessionLocal
from app.models import (
    Entrenamiento,
    EntrenamientoFuerza,
    EnumEstadoEntrenamiento,
    NotificationPreference,
    PushDelivery,
    PushSubscription,
    TrainingReminder,
    Usuario,
)
from app.notifications.push import send_training_push
from app.notifications.service import utc_now
from app.settings import (
    PUSH_MAX_ATTEMPTS,
    PUSH_WORKER_POLL_SECONDS,
    VAPID_PRIVATE_KEY,
    VAPID_PUBLIC_KEY,
    VAPID_SUBJECT,
)


logger = logging.getLogger("training-push-worker")
RETRY_DELAY = timedelta(minutes=5)
STALE_CLAIM_AFTER = timedelta(minutes=10)


async def claim_due_reminder() -> int | None:
    async with AsyncSessionLocal() as db:
        async with db.begin():
            now = utc_now()
            await db.execute(
                update(TrainingReminder)
                .where(
                    TrainingReminder.status == "processing",
                    TrainingReminder.claimed_at < now - STALE_CLAIM_AFTER,
                    TrainingReminder.attempts < PUSH_MAX_ATTEMPTS,
                )
                .values(status="pending", claimed_at=None)
            )
            reminder = await db.scalar(
                select(TrainingReminder)
                .where(
                    TrainingReminder.status == "pending",
                    TrainingReminder.send_at <= now,
                    TrainingReminder.attempts < PUSH_MAX_ATTEMPTS,
                )
                .order_by(TrainingReminder.send_at, TrainingReminder.id_reminder)
                .with_for_update(skip_locked=True)
                .limit(1)
            )
            if reminder is None:
                return None

            reminder.status = "processing"
            reminder.claimed_at = now
            reminder.attempts += 1
            return reminder.id_reminder


async def _finish_reminder(
    id_reminder: int,
    *,
    status: str,
    error: str | None = None,
    retry: bool = False,
) -> None:
    async with AsyncSessionLocal() as db:
        reminder = await db.get(TrainingReminder, id_reminder)
        if reminder is None or reminder.status == "cancelled":
            return
        now = utc_now()
        reminder.status = "pending" if retry else status
        reminder.claimed_at = None
        reminder.last_error = error[:500] if error else None
        if retry:
            reminder.send_at = now + RETRY_DELAY
        elif status == "sent":
            reminder.sent_at = now
        await db.commit()


async def process_reminder(id_reminder: int) -> None:
    async with AsyncSessionLocal() as db:
        row = (
            await db.execute(
                select(
                    TrainingReminder,
                    EntrenamientoFuerza,
                    Usuario.auth_user_id,
                )
                .join(
                    EntrenamientoFuerza,
                    EntrenamientoFuerza.id_entrenamiento_fuerza
                    == TrainingReminder.id_entrenamiento_fuerza,
                )
                .join(
                    Entrenamiento,
                    Entrenamiento.id_entrenamiento
                    == EntrenamientoFuerza.id_entrenamiento,
                )
                .join(Usuario, Usuario.id_usuario == Entrenamiento.id_usuario)
                .where(TrainingReminder.id_reminder == id_reminder)
            )
        ).one_or_none()
        if row is None:
            return

        reminder, workout, auth_user_id = row
        if workout.estado != EnumEstadoEntrenamiento.ACTIVO:
            reminder.status = "cancelled"
            reminder.cancelled_at = utc_now()
            reminder.claimed_at = None
            await db.commit()
            return

        preference = await db.get(NotificationPreference, auth_user_id)
        if preference is None or not preference.training_reminders_enabled:
            reminder.status = "skipped"
            reminder.claimed_at = None
            reminder.last_error = "Recordatorios desactivados por el usuario."
            await db.commit()
            return

        subscriptions = (
            await db.scalars(
                select(PushSubscription).where(
                    PushSubscription.auth_user_id == auth_user_id,
                    PushSubscription.enabled.is_(True),
                )
            )
        ).all()
        if not subscriptions:
            reminder.status = "skipped"
            reminder.claimed_at = None
            reminder.last_error = "No hay dispositivos suscritos."
            await db.commit()
            return

        had_transient_failure = False
        last_error: str | None = None

        for subscription in subscriptions:
            await db.refresh(reminder)
            if reminder.status == "cancelled":
                return

            delivery = await db.scalar(
                select(PushDelivery).where(
                    PushDelivery.id_reminder == reminder.id_reminder,
                    PushDelivery.id_subscription == subscription.id_subscription,
                )
            )
            if delivery is not None and delivery.status in {"sent", "expired"}:
                continue
            if delivery is None:
                delivery = PushDelivery(
                    id_reminder=reminder.id_reminder,
                    id_subscription=subscription.id_subscription,
                )
                db.add(delivery)

            delivery.attempts += 1
            await db.commit()

            try:
                await asyncio.to_thread(
                    send_training_push,
                    subscription,
                    reminder.milestone,
                )
            except WebPushException as exc:
                status_code = getattr(exc.response, "status_code", None)
                message = str(exc)[:500]
                delivery.last_error = message
                subscription.failure_count += 1
                subscription.updated_at = utc_now()
                if status_code in {404, 410}:
                    delivery.status = "expired"
                    subscription.enabled = False
                    subscription.disabled_at = utc_now()
                else:
                    delivery.status = "failed"
                    had_transient_failure = True
                    last_error = message
                await db.commit()
            except Exception as exc:
                message = f"{type(exc).__name__}: {exc}"[:500]
                delivery.status = "failed"
                delivery.last_error = message
                subscription.failure_count += 1
                subscription.updated_at = utc_now()
                had_transient_failure = True
                last_error = message
                await db.commit()
            else:
                now = utc_now()
                delivery.status = "sent"
                delivery.sent_at = now
                delivery.last_error = None
                subscription.failure_count = 0
                subscription.last_success_at = now
                subscription.updated_at = now
                await db.commit()

    attempts = reminder.attempts
    if had_transient_failure and attempts < PUSH_MAX_ATTEMPTS:
        await _finish_reminder(
            id_reminder,
            status="failed",
            error=last_error,
            retry=True,
        )
    elif had_transient_failure:
        await _finish_reminder(
            id_reminder,
            status="failed",
            error=last_error or "Se agotaron los reintentos.",
        )
    else:
        await _finish_reminder(id_reminder, status="sent")


async def run_worker() -> None:
    if not (VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY and VAPID_SUBJECT):
        raise RuntimeError(
            "Faltan VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY o VAPID_SUBJECT."
        )

    logger.info("Worker de recordatorios Push iniciado")
    while True:
        try:
            id_reminder = await claim_due_reminder()
            if id_reminder is None:
                await asyncio.sleep(PUSH_WORKER_POLL_SECONDS)
                continue
            await process_reminder(id_reminder)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Error procesando recordatorios; se reintentara")
            await asyncio.sleep(PUSH_WORKER_POLL_SECONDS)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_worker())
