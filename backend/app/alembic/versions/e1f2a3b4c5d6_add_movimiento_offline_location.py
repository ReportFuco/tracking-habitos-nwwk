"""add movimiento offline idempotency and purchase location

Revision ID: e1f2a3b4c5d6
Revises: d0e1f2a3b4c5
Create Date: 2026-07-30
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.models.db_schemas import FINANZAS_SCHEMA


revision: str = "e1f2a3b4c5d6"
down_revision: Union[str, Sequence[str], None] = "d0e1f2a3b4c5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "movimiento",
        sa.Column("client_request_id", sa.Uuid(), nullable=True),
        schema=FINANZAS_SCHEMA,
    )
    op.add_column(
        "movimiento",
        sa.Column(
            "en_lugar_compra",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        schema=FINANZAS_SCHEMA,
    )
    op.add_column(
        "movimiento",
        sa.Column("latitud", sa.Numeric(10, 7), nullable=True),
        schema=FINANZAS_SCHEMA,
    )
    op.add_column(
        "movimiento",
        sa.Column("longitud", sa.Numeric(10, 7), nullable=True),
        schema=FINANZAS_SCHEMA,
    )
    op.add_column(
        "movimiento",
        sa.Column("precision_ubicacion", sa.Numeric(10, 2), nullable=True),
        schema=FINANZAS_SCHEMA,
    )
    op.create_unique_constraint(
        "uq_movimiento_client_request_id",
        "movimiento",
        ["client_request_id"],
        schema=FINANZAS_SCHEMA,
    )
    op.create_check_constraint(
        "ck_movimiento_ubicacion_segun_lugar",
        "movimiento",
        "(en_lugar_compra AND latitud IS NOT NULL AND longitud IS NOT NULL "
        "AND precision_ubicacion IS NOT NULL) OR "
        "(NOT en_lugar_compra AND latitud IS NULL AND longitud IS NULL "
        "AND precision_ubicacion IS NULL)",
        schema=FINANZAS_SCHEMA,
    )
    op.create_check_constraint(
        "ck_movimiento_latitud_rango",
        "movimiento",
        "latitud IS NULL OR latitud BETWEEN -90 AND 90",
        schema=FINANZAS_SCHEMA,
    )
    op.create_check_constraint(
        "ck_movimiento_longitud_rango",
        "movimiento",
        "longitud IS NULL OR longitud BETWEEN -180 AND 180",
        schema=FINANZAS_SCHEMA,
    )
    op.create_check_constraint(
        "ck_movimiento_precision_no_negativa",
        "movimiento",
        "precision_ubicacion IS NULL OR precision_ubicacion >= 0",
        schema=FINANZAS_SCHEMA,
    )
    op.create_check_constraint(
        "ck_movimiento_ubicacion_solo_gasto",
        "movimiento",
        "NOT en_lugar_compra OR tipo_movimiento = 'gasto'",
        schema=FINANZAS_SCHEMA,
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_movimiento_ubicacion_solo_gasto",
        "movimiento",
        schema=FINANZAS_SCHEMA,
        type_="check",
    )
    op.drop_constraint(
        "ck_movimiento_precision_no_negativa",
        "movimiento",
        schema=FINANZAS_SCHEMA,
        type_="check",
    )
    op.drop_constraint(
        "ck_movimiento_longitud_rango",
        "movimiento",
        schema=FINANZAS_SCHEMA,
        type_="check",
    )
    op.drop_constraint(
        "ck_movimiento_latitud_rango",
        "movimiento",
        schema=FINANZAS_SCHEMA,
        type_="check",
    )
    op.drop_constraint(
        "ck_movimiento_ubicacion_segun_lugar",
        "movimiento",
        schema=FINANZAS_SCHEMA,
        type_="check",
    )
    op.drop_constraint(
        "uq_movimiento_client_request_id",
        "movimiento",
        schema=FINANZAS_SCHEMA,
        type_="unique",
    )
    op.drop_column("movimiento", "precision_ubicacion", schema=FINANZAS_SCHEMA)
    op.drop_column("movimiento", "longitud", schema=FINANZAS_SCHEMA)
    op.drop_column("movimiento", "latitud", schema=FINANZAS_SCHEMA)
    op.drop_column("movimiento", "en_lugar_compra", schema=FINANZAS_SCHEMA)
    op.drop_column("movimiento", "client_request_id", schema=FINANZAS_SCHEMA)
