"""add postgres schemas by domain

Revision ID: 878727dff0b2
Revises: b55e6790738e
Create Date: 2026-03-29 21:53:38.561021

"""

from typing import Sequence, Union

from alembic import op


revision: str = "878727dff0b2"
down_revision: Union[str, Sequence[str], None] = "b55e6790738e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


SCHEMA_TABLES = {
    "auth": ["user"],
    "usuarios": ["usuario", "mensaje"],
    "habitos": ["categoria_habito", "habito", "registro_habito"],
    "lecturas": ["libros", "lectura", "registro_lectura"],
    "finanzas": ["banco", "categoria_finanza", "cuenta_bancaria", "movimiento"],
    "entrenamientos": [
        "gimnasio",
        "entrenamiento",
        "entrenamiento_aerobico",
        "entrenamiento_fuerza",
        "serie_fuerza",
        "ejercicios",
    ],
}

SCHEMA_ENUMS = {
    "lecturas": ["estado_lectura"],
    "finanzas": ["cuentas_bancarias", "tipo_movimiento", "tipo_gasto"],
    "entrenamientos": [
        "tipo_entrenamiento",
        "tipo aerobico",
        "estado_entrenamiento_fuerza",
        "musculos",
    ],
}


def _create_schema(schema: str) -> None:
    op.execute(f'CREATE SCHEMA IF NOT EXISTS "{schema}"')


def _drop_schema(schema: str) -> None:
    op.execute(f'DROP SCHEMA IF EXISTS "{schema}"')


def _move_table(from_schema: str, to_schema: str, table: str) -> None:
    op.execute(
        f'ALTER TABLE IF EXISTS "{from_schema}"."{table}" SET SCHEMA "{to_schema}"'
    )


def _move_type(from_schema: str, to_schema: str, enum_name: str) -> None:
    op.execute(
        f"""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_type t
                JOIN pg_namespace n ON n.oid = t.typnamespace
                WHERE t.typname = '{enum_name}'
                  AND n.nspname = '{from_schema}'
            ) THEN
                EXECUTE 'ALTER TYPE "{from_schema}"."{enum_name}" SET SCHEMA "{to_schema}"';
            END IF;
        END $$;
        """
    )


def upgrade() -> None:
    """Upgrade schema."""
    for schema in SCHEMA_TABLES:
        _create_schema(schema)

    for schema, enum_names in SCHEMA_ENUMS.items():
        for enum_name in enum_names:
            _move_type("public", schema, enum_name)

    for schema, tables in SCHEMA_TABLES.items():
        for table in tables:
            _move_table("public", schema, table)


def downgrade() -> None:
    """Downgrade schema."""
    for schema, tables in SCHEMA_TABLES.items():
        for table in tables:
            _move_table(schema, "public", table)

    for schema, enum_names in SCHEMA_ENUMS.items():
        for enum_name in enum_names:
            _move_type(schema, "public", enum_name)

    for schema in reversed(list(SCHEMA_TABLES)):
        _drop_schema(schema)
