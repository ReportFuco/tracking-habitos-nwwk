"""recordatorio diario de gastos

Preferencias del aviso Push que recuerda registrar los gastos del dia: si esta activo, a
que hora (calendario de Chile) y el ultimo dia ya procesado, para no avisar dos veces.

Revision ID: a4b5c6d7e8f9
Revises: e5b9c1d3f7a2
Create Date: 2026-10-15 18:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a4b5c6d7e8f9"
down_revision: Union[str, Sequence[str], None] = "e5b9c1d3f7a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "notification_preference",
        sa.Column(
            "expense_reminders_enabled",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        schema="notificaciones",
    )
    op.add_column(
        "notification_preference",
        sa.Column(
            "expense_reminder_time",
            sa.Time(),
            server_default=sa.text("'21:00'"),
            nullable=False,
        ),
        schema="notificaciones",
    )
    op.add_column(
        "notification_preference",
        sa.Column("expense_reminder_last_on", sa.Date(), nullable=True),
        schema="notificaciones",
    )


def downgrade() -> None:
    op.drop_column("notification_preference", "expense_reminder_last_on", schema="notificaciones")
    op.drop_column("notification_preference", "expense_reminder_time", schema="notificaciones")
    op.drop_column("notification_preference", "expense_reminders_enabled", schema="notificaciones")
