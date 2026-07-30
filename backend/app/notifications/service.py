from datetime import datetime, timedelta, timezone

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import EntrenamientoFuerza, TrainingReminder
from app.settings import (
    TRAINING_REMINDER_FIRST_MINUTES,
    TRAINING_REMINDER_SECOND_MINUTES,
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def schedule_training_reminders(
    db: AsyncSession,
    workout: EntrenamientoFuerza,
) -> list[TrainingReminder]:
    started_at = ensure_utc(workout.inicio_at)
    reminders = [
        TrainingReminder(
            id_entrenamiento_fuerza=workout.id_entrenamiento_fuerza,
            milestone="1h",
            send_at=started_at + timedelta(minutes=TRAINING_REMINDER_FIRST_MINUTES),
        ),
        TrainingReminder(
            id_entrenamiento_fuerza=workout.id_entrenamiento_fuerza,
            milestone="2h",
            send_at=started_at + timedelta(minutes=TRAINING_REMINDER_SECOND_MINUTES),
        ),
    ]
    db.add_all(reminders)
    return reminders


async def cancel_training_reminders(
    db: AsyncSession,
    id_entrenamiento_fuerza: int,
) -> None:
    now = utc_now()
    await db.execute(
        update(TrainingReminder)
        .where(
            TrainingReminder.id_entrenamiento_fuerza == id_entrenamiento_fuerza,
            TrainingReminder.status.in_(("pending", "processing")),
        )
        .values(
            status="cancelled",
            cancelled_at=now,
            claimed_at=None,
            last_error=None,
        )
    )
