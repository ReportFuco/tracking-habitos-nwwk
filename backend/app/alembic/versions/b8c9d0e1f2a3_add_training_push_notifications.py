"""add durable training push notifications

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-07-28 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b8c9d0e1f2a3"
down_revision: Union[str, Sequence[str], None] = "a7b8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS notificaciones")

    # Estos campos se guardaban como timestamp sin zona. PostgreSQL los generaba con
    # now(); los interpretamos como UTC para hacer comparables los vencimientos.
    op.execute(
        """
        ALTER TABLE entrenamientos.entrenamiento_fuerza
        ALTER COLUMN inicio_at TYPE TIMESTAMPTZ
        USING inicio_at AT TIME ZONE 'UTC'
        """
    )
    op.execute(
        """
        ALTER TABLE entrenamientos.entrenamiento_fuerza
        ALTER COLUMN fin_at TYPE TIMESTAMPTZ
        USING fin_at AT TIME ZONE 'UTC'
        """
    )

    op.create_table(
        "notification_preference",
        sa.Column("auth_user_id", sa.Integer(), nullable=False),
        sa.Column(
            "training_reminders_enabled",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["auth_user_id"], ["auth.user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("auth_user_id"),
        schema="notificaciones",
    )

    op.create_table(
        "push_subscription",
        sa.Column("id_subscription", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("auth_user_id", sa.Integer(), nullable=False),
        sa.Column("endpoint", sa.Text(), nullable=False),
        sa.Column("p256dh", sa.String(length=255), nullable=False),
        sa.Column("auth_key", sa.String(length=255), nullable=False),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.Column("enabled", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("failure_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("last_success_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("disabled_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["auth_user_id"], ["auth.user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id_subscription"),
        sa.UniqueConstraint("endpoint", name="uq_push_subscription_endpoint"),
        schema="notificaciones",
    )
    op.create_index(
        "ix_push_subscription_auth_user_id",
        "push_subscription",
        ["auth_user_id"],
        schema="notificaciones",
    )

    op.create_table(
        "training_reminder",
        sa.Column("id_reminder", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("id_entrenamiento_fuerza", sa.Integer(), nullable=False),
        sa.Column("milestone", sa.String(length=20), nullable=False),
        sa.Column("send_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="pending", nullable=False),
        sa.Column("attempts", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.String(length=500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["id_entrenamiento_fuerza"],
            ["entrenamientos.entrenamiento_fuerza.id_entrenamiento_fuerza"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id_reminder"),
        sa.UniqueConstraint(
            "id_entrenamiento_fuerza",
            "milestone",
            name="uq_training_reminder_workout_milestone",
        ),
        schema="notificaciones",
    )
    op.create_index(
        "ix_training_reminder_workout",
        "training_reminder",
        ["id_entrenamiento_fuerza"],
        schema="notificaciones",
    )
    op.create_index(
        "ix_training_reminder_due",
        "training_reminder",
        ["status", "send_at"],
        schema="notificaciones",
    )

    op.create_table(
        "push_delivery",
        sa.Column("id_delivery", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("id_reminder", sa.Integer(), nullable=False),
        sa.Column("id_subscription", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="pending", nullable=False),
        sa.Column("attempts", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.String(length=500), nullable=True),
        sa.ForeignKeyConstraint(
            ["id_reminder"],
            ["notificaciones.training_reminder.id_reminder"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["id_subscription"],
            ["notificaciones.push_subscription.id_subscription"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id_delivery"),
        sa.UniqueConstraint(
            "id_reminder",
            "id_subscription",
            name="uq_push_delivery_reminder_subscription",
        ),
        schema="notificaciones",
    )
    op.create_index(
        "ix_push_delivery_reminder",
        "push_delivery",
        ["id_reminder"],
        schema="notificaciones",
    )
    op.create_index(
        "ix_push_delivery_subscription",
        "push_delivery",
        ["id_subscription"],
        schema="notificaciones",
    )


def downgrade() -> None:
    op.drop_table("push_delivery", schema="notificaciones")
    op.drop_table("training_reminder", schema="notificaciones")
    op.drop_table("push_subscription", schema="notificaciones")
    op.drop_table("notification_preference", schema="notificaciones")
    op.execute(
        """
        ALTER TABLE entrenamientos.entrenamiento_fuerza
        ALTER COLUMN fin_at TYPE TIMESTAMP
        USING fin_at AT TIME ZONE 'UTC'
        """
    )
    op.execute(
        """
        ALTER TABLE entrenamientos.entrenamiento_fuerza
        ALTER COLUMN inicio_at TYPE TIMESTAMP
        USING inicio_at AT TIME ZONE 'UTC'
        """
    )
    op.execute("DROP SCHEMA IF EXISTS notificaciones")
