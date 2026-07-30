from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.db_schemas import (
    AUTH_SCHEMA,
    ENTRENAMIENTOS_SCHEMA,
    NOTIFICACIONES_SCHEMA,
    table_ref,
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class NotificationPreference(Base):
    __tablename__ = "notification_preference"
    __table_args__ = {"schema": NOTIFICACIONES_SCHEMA}

    auth_user_id: Mapped[int] = mapped_column(
        ForeignKey(table_ref(AUTH_SCHEMA, "user.id"), ondelete="CASCADE"),
        primary_key=True,
    )
    training_reminders_enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        server_default=text("now()"),
    )


class PushSubscription(Base):
    __tablename__ = "push_subscription"
    __table_args__ = (
        Index("ix_push_subscription_auth_user_id", "auth_user_id"),
        {"schema": NOTIFICACIONES_SCHEMA},
    )

    id_subscription: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    auth_user_id: Mapped[int] = mapped_column(
        ForeignKey(table_ref(AUTH_SCHEMA, "user.id"), ondelete="CASCADE"),
        nullable=False,
    )
    endpoint: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    p256dh: Mapped[str] = mapped_column(String(255), nullable=False)
    auth_key: Mapped[str] = mapped_column(String(255), nullable=False)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)
    enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
    )
    failure_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default=text("0"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        server_default=text("now()"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        server_default=text("now()"),
    )
    last_success_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    disabled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class TrainingReminder(Base):
    __tablename__ = "training_reminder"
    __table_args__ = (
        UniqueConstraint(
            "id_entrenamiento_fuerza",
            "milestone",
            name="uq_training_reminder_workout_milestone",
        ),
        Index("ix_training_reminder_workout", "id_entrenamiento_fuerza"),
        Index("ix_training_reminder_due", "status", "send_at"),
        {"schema": NOTIFICACIONES_SCHEMA},
    )

    id_reminder: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_entrenamiento_fuerza: Mapped[int] = mapped_column(
        ForeignKey(
            table_ref(ENTRENAMIENTOS_SCHEMA, "entrenamiento_fuerza.id_entrenamiento_fuerza"),
            ondelete="CASCADE",
        ),
        nullable=False,
    )
    milestone: Mapped[str] = mapped_column(String(20), nullable=False)
    send_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="pending",
        server_default="pending",
    )
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default=text("0"))
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        server_default=text("now()"),
    )


class PushDelivery(Base):
    __tablename__ = "push_delivery"
    __table_args__ = (
        UniqueConstraint(
            "id_reminder",
            "id_subscription",
            name="uq_push_delivery_reminder_subscription",
        ),
        Index("ix_push_delivery_reminder", "id_reminder"),
        Index("ix_push_delivery_subscription", "id_subscription"),
        {"schema": NOTIFICACIONES_SCHEMA},
    )

    id_delivery: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_reminder: Mapped[int] = mapped_column(
        ForeignKey(
            table_ref(NOTIFICACIONES_SCHEMA, "training_reminder.id_reminder"),
            ondelete="CASCADE",
        ),
        nullable=False,
    )
    id_subscription: Mapped[int] = mapped_column(
        ForeignKey(
            table_ref(NOTIFICACIONES_SCHEMA, "push_subscription.id_subscription"),
            ondelete="CASCADE",
        ),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="pending",
        server_default="pending",
    )
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default=text("0"))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(String(500))
