"""deudas e importaciones de movimientos

- ``finanzas.deuda``: lo que el usuario debe (``debo``) o le deben (``me_deben``). El
  saldo no se guarda: es el monto total menos los movimientos que la abonan.
- ``finanzas.importacion``: cada carga masiva hecha por MCP, para poder deshacerla.
- ``finanzas.movimiento``: ``id_deuda`` e ``id_importacion``, ambas nulas y con
  ``ON DELETE SET NULL`` (borrar una deuda no borra sus abonos).

Revision ID: c3f7a9d1e5b2
Revises: b8d4f0a2c6e1
Create Date: 2026-09-30
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "c3f7a9d1e5b2"
down_revision: Union[str, Sequence[str], None] = "b8d4f0a2c6e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


tipo_deuda = postgresql.ENUM("debo", "me_deben", name="tipo_deuda", schema="finanzas", create_type=False)


def upgrade() -> None:
    tipo_deuda.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "deuda",
        sa.Column("id_deuda", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("id_usuario", sa.Integer(), nullable=False),
        sa.Column("tipo", tipo_deuda, nullable=False),
        sa.Column("nombre", sa.String(length=120), nullable=False),
        sa.Column("contraparte", sa.String(length=120), nullable=True),
        sa.Column("monto_total", sa.Integer(), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("monto_total > 0", name="ck_deuda_monto_total_positivo"),
        sa.ForeignKeyConstraint(["id_usuario"], ["usuarios.usuario.id_usuario"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id_deuda"),
        schema="finanzas",
    )
    op.create_index("ix_finanzas_deuda_id_usuario", "deuda", ["id_usuario"], schema="finanzas")

    op.create_table(
        "importacion",
        sa.Column("id_importacion", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("id_usuario", sa.Integer(), nullable=False),
        sa.Column("id_cuenta", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=160), nullable=True),
        sa.Column("cantidad", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["id_usuario"], ["usuarios.usuario.id_usuario"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["id_cuenta"], ["finanzas.cuenta_usuario.id_cuenta"]),
        sa.PrimaryKeyConstraint("id_importacion"),
        schema="finanzas",
    )
    op.create_index("ix_finanzas_importacion_id_usuario", "importacion", ["id_usuario"], schema="finanzas")

    op.add_column("movimiento", sa.Column("id_deuda", sa.Integer(), nullable=True), schema="finanzas")
    op.add_column("movimiento", sa.Column("id_importacion", sa.Integer(), nullable=True), schema="finanzas")
    op.create_foreign_key(
        "movimiento_id_deuda_fkey",
        "movimiento",
        "deuda",
        ["id_deuda"],
        ["id_deuda"],
        source_schema="finanzas",
        referent_schema="finanzas",
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "movimiento_id_importacion_fkey",
        "movimiento",
        "importacion",
        ["id_importacion"],
        ["id_importacion"],
        source_schema="finanzas",
        referent_schema="finanzas",
        ondelete="SET NULL",
    )
    op.create_index("ix_finanzas_movimiento_id_deuda", "movimiento", ["id_deuda"], schema="finanzas")
    op.create_index("ix_finanzas_movimiento_id_importacion", "movimiento", ["id_importacion"], schema="finanzas")


def downgrade() -> None:
    op.drop_index("ix_finanzas_movimiento_id_importacion", table_name="movimiento", schema="finanzas")
    op.drop_index("ix_finanzas_movimiento_id_deuda", table_name="movimiento", schema="finanzas")
    op.drop_constraint("movimiento_id_importacion_fkey", "movimiento", schema="finanzas", type_="foreignkey")
    op.drop_constraint("movimiento_id_deuda_fkey", "movimiento", schema="finanzas", type_="foreignkey")
    op.drop_column("movimiento", "id_importacion", schema="finanzas")
    op.drop_column("movimiento", "id_deuda", schema="finanzas")
    op.drop_index("ix_finanzas_importacion_id_usuario", table_name="importacion", schema="finanzas")
    op.drop_table("importacion", schema="finanzas")
    op.drop_index("ix_finanzas_deuda_id_usuario", table_name="deuda", schema="finanzas")
    op.drop_table("deuda", schema="finanzas")
    tipo_deuda.drop(op.get_bind(), checkfirst=True)
