"""add entrenamiento_fuerza and serie_fuerza idempotency keys

Revision ID: d025097740d9
Revises: f2a3b4c5d6e7
Create Date: 2026-08-02
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.models.db_schemas import ENTRENAMIENTOS_SCHEMA


revision: str = "d025097740d9"
down_revision: Union[str, Sequence[str], None] = "f2a3b4c5d6e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "entrenamiento_fuerza",
        sa.Column("client_request_id", sa.Uuid(), nullable=True),
        schema=ENTRENAMIENTOS_SCHEMA,
    )
    op.add_column(
        "entrenamiento_fuerza",
        sa.Column("cierre_client_request_id", sa.Uuid(), nullable=True),
        schema=ENTRENAMIENTOS_SCHEMA,
    )
    op.add_column(
        "serie_fuerza",
        sa.Column("client_request_id", sa.Uuid(), nullable=True),
        schema=ENTRENAMIENTOS_SCHEMA,
    )
    op.create_unique_constraint(
        "uq_entrenamiento_fuerza_client_request_id",
        "entrenamiento_fuerza",
        ["client_request_id"],
        schema=ENTRENAMIENTOS_SCHEMA,
    )
    op.create_unique_constraint(
        "uq_entrenamiento_fuerza_cierre_client_request_id",
        "entrenamiento_fuerza",
        ["cierre_client_request_id"],
        schema=ENTRENAMIENTOS_SCHEMA,
    )
    op.create_unique_constraint(
        "uq_serie_fuerza_client_request_id",
        "serie_fuerza",
        ["client_request_id"],
        schema=ENTRENAMIENTOS_SCHEMA,
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_serie_fuerza_client_request_id",
        "serie_fuerza",
        schema=ENTRENAMIENTOS_SCHEMA,
        type_="unique",
    )
    op.drop_constraint(
        "uq_entrenamiento_fuerza_cierre_client_request_id",
        "entrenamiento_fuerza",
        schema=ENTRENAMIENTOS_SCHEMA,
        type_="unique",
    )
    op.drop_constraint(
        "uq_entrenamiento_fuerza_client_request_id",
        "entrenamiento_fuerza",
        schema=ENTRENAMIENTOS_SCHEMA,
        type_="unique",
    )
    op.drop_column("serie_fuerza", "client_request_id", schema=ENTRENAMIENTOS_SCHEMA)
    op.drop_column(
        "entrenamiento_fuerza", "cierre_client_request_id", schema=ENTRENAMIENTOS_SCHEMA
    )
    op.drop_column("entrenamiento_fuerza", "client_request_id", schema=ENTRENAMIENTOS_SCHEMA)
