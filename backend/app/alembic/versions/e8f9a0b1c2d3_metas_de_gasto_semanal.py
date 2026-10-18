"""metas de gasto semanal, alertas y reglas de categoría

- ``finanzas.meta_gasto``: meta de gasto semanal (lunes a domingo) de cada usuario.
- ``finanzas.preferencia_categoria``: por usuario y categoría, presupuesto semanal, si queda
  fuera del gasto semanal (gastos fijos, pago de la tarjeta) y si está oculta al registrar.
- ``finanzas.regla_categoria``: categoría automática según la descripción del movimiento.
- ``notificaciones.notification_preference.budget_alerts_enabled``: avisos Push de metas.
- ``notificaciones.alerta_gasto``: alertas ya enviadas, para no repetirlas.

Revision ID: e8f9a0b1c2d3
Revises: d7e8f9a0b1c2
Create Date: 2026-10-18 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e8f9a0b1c2d3"
down_revision: Union[str, Sequence[str], None] = "d7e8f9a0b1c2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "meta_gasto",
        sa.Column("id_usuario", sa.Integer(), nullable=False),
        sa.Column("meta_semanal", sa.Integer(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "meta_semanal IS NULL OR meta_semanal > 0",
            name="ck_meta_gasto_semanal_positiva",
        ),
        sa.ForeignKeyConstraint(["id_usuario"], ["usuarios.usuario.id_usuario"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id_usuario"),
        schema="finanzas",
    )
    op.create_table(
        "preferencia_categoria",
        sa.Column("id_usuario", sa.Integer(), nullable=False),
        sa.Column("id_categoria", sa.Integer(), nullable=False),
        sa.Column("presupuesto_semanal", sa.Integer(), nullable=True),
        sa.Column("excluida", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("oculta", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "presupuesto_semanal IS NULL OR presupuesto_semanal > 0",
            name="ck_preferencia_categoria_presupuesto_positivo",
        ),
        sa.ForeignKeyConstraint(["id_usuario"], ["usuarios.usuario.id_usuario"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["id_categoria"], ["finanzas.categoria_finanza.id_categoria"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id_usuario", "id_categoria"),
        schema="finanzas",
    )
    op.create_table(
        "regla_categoria",
        sa.Column("id_regla", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("id_usuario", sa.Integer(), nullable=False),
        sa.Column("patron", sa.String(length=80), nullable=False),
        sa.Column("id_categoria", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["id_usuario"], ["usuarios.usuario.id_usuario"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["id_categoria"], ["finanzas.categoria_finanza.id_categoria"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id_regla"),
        schema="finanzas",
    )
    op.create_index(
        "ix_finanzas_regla_categoria_id_usuario", "regla_categoria", ["id_usuario"], schema="finanzas"
    )
    op.create_index(
        "uq_regla_categoria_usuario_patron",
        "regla_categoria",
        ["id_usuario", sa.text("lower(patron)")],
        unique=True,
        schema="finanzas",
    )
    op.add_column(
        "notification_preference",
        sa.Column(
            "budget_alerts_enabled",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        schema="notificaciones",
    )
    op.create_table(
        "alerta_gasto",
        sa.Column("id_alerta", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("auth_user_id", sa.Integer(), nullable=False),
        sa.Column("clave", sa.String(length=80), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.ForeignKeyConstraint(["auth_user_id"], ["auth.user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id_alerta"),
        sa.UniqueConstraint("auth_user_id", "clave", name="uq_alerta_gasto_usuario_clave"),
        schema="notificaciones",
    )


def downgrade() -> None:
    op.drop_table("alerta_gasto", schema="notificaciones")
    op.drop_column("notification_preference", "budget_alerts_enabled", schema="notificaciones")
    op.drop_table("regla_categoria", schema="finanzas")
    op.drop_table("preferencia_categoria", schema="finanzas")
    op.drop_table("meta_gasto", schema="finanzas")
