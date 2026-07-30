"""import ejercicios dataset

Carga el catálogo público de ejercicios (1324 registros con imagen, animación e
instrucciones en español) desde `app/alembic/data/ejercicios_dataset.json`.

Los ejercicios que el usuario ya tenía no se duplican ni se reemplazan: si el nombre
coincide, se enriquece la fila existente con el media y las instrucciones y se conserva su
`id_ejercicio`, porque las series de fuerza ya registradas apuntan a él.

La importación es idempotente: `codigo_externo` marca lo que vino del dataset, así que
reejecutarla no vuelve a insertar.

Revision ID: d0e1f2a3b4c5
Revises: c9d0e1f2a3b4
Create Date: 2026-07-30 00:00:01.000000

"""

import json
import unicodedata
from pathlib import Path
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d0e1f2a3b4c5"
down_revision: Union[str, Sequence[str], None] = "c9d0e1f2a3b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


SCHEMA = "entrenamientos"
DATASET = Path(__file__).resolve().parent.parent / "data" / "ejercicios_dataset.json"

# Insertar de a uno son 1324 roundtrips; en lotes la migración corre en segundos.
TAMANO_LOTE = 200


def normalizar(valor: str) -> str:
    """Misma normalización que usa la búsqueda de la API: sin tildes y en minúsculas."""
    descompuesto = unicodedata.normalize("NFKD", valor.strip().lower())
    return "".join(char for char in descompuesto if not unicodedata.combining(char))


def upgrade() -> None:
    conexion = op.get_bind()
    registros = json.loads(DATASET.read_text(encoding="utf-8"))

    subcategorias = {
        (musculo, subcategoria): id_subcategoria
        for musculo, subcategoria, id_subcategoria in conexion.execute(
            sa.text(
                f"""
                SELECT m.codigo, s.codigo, s.id_subcategoria_musculo
                FROM {SCHEMA}.subcategoria_musculo s
                JOIN {SCHEMA}.musculo m ON m.id_musculo = s.id_musculo
                """
            )
        )
    }

    existentes = {
        normalizar(nombre): (id_ejercicio, codigo_externo)
        for id_ejercicio, nombre, codigo_externo in conexion.execute(
            sa.text(
                f"SELECT id_ejercicio, nombre, codigo_externo FROM {SCHEMA}.ejercicios"
            )
        )
    }

    nuevos = []
    enriquecidos = []

    for registro in registros:
        id_subcategoria = subcategorias.get(
            (registro["musculo"], registro["subcategoria"])
        )

        if id_subcategoria is None:
            raise RuntimeError(
                f"Falta la subcategoría {registro['musculo']}/{registro['subcategoria']}"
            )

        fila = {
            "codigo_externo": registro["codigo_externo"],
            "nombre": registro["nombre"],
            "nombre_original": registro["nombre_original"],
            "id_subcategoria_musculo": id_subcategoria,
            "equipamiento": registro["equipamiento"],
            "musculos_secundarios": json.dumps(
                registro["musculos_secundarios"], ensure_ascii=False
            ),
            "instrucciones": json.dumps(registro["instrucciones"], ensure_ascii=False),
            "url_imagen": registro["url_imagen"],
            "url_animacion": registro["url_animacion"],
            "atribucion": registro["atribucion"],
        }

        coincidencia = existentes.get(normalizar(registro["nombre"]))

        if coincidencia is None:
            nuevos.append(fila)
            continue

        id_ejercicio, codigo_externo = coincidencia

        # Ya importado en una corrida anterior: nada que hacer.
        if codigo_externo is not None:
            continue

        # Ejercicio propio del usuario con el mismo nombre: se le añade el material del
        # dataset pero se respeta la subcategoría que él eligió.
        enriquecidos.append({**fila, "id_ejercicio": id_ejercicio})

    insertar = sa.text(
        f"""
        INSERT INTO {SCHEMA}.ejercicios (
            nombre, nombre_original, id_subcategoria_musculo, codigo_externo,
            equipamiento, musculos_secundarios, instrucciones, url_imagen,
            url_animacion, atribucion
        ) VALUES (
            :nombre, :nombre_original, :id_subcategoria_musculo, :codigo_externo,
            :equipamiento, CAST(:musculos_secundarios AS JSONB),
            CAST(:instrucciones AS JSONB), :url_imagen, :url_animacion, :atribucion
        )
        """
    )

    for inicio in range(0, len(nuevos), TAMANO_LOTE):
        conexion.execute(insertar, nuevos[inicio : inicio + TAMANO_LOTE])

    if enriquecidos:
        conexion.execute(
            sa.text(
                f"""
                UPDATE {SCHEMA}.ejercicios SET
                    codigo_externo = :codigo_externo,
                    nombre_original = :nombre_original,
                    equipamiento = :equipamiento,
                    musculos_secundarios = CAST(:musculos_secundarios AS JSONB),
                    instrucciones = CAST(:instrucciones AS JSONB),
                    url_imagen = :url_imagen,
                    url_animacion = :url_animacion,
                    atribucion = :atribucion
                WHERE id_ejercicio = :id_ejercicio
                """
            ),
            enriquecidos,
        )


def downgrade() -> None:
    conexion = op.get_bind()

    # Los ejercicios importados que ya se usaron en una serie no se borran: perder la
    # serie sería peor que dejar una fila de más. Se les quita solo el material añadido.
    conexion.execute(
        sa.text(
            f"""
            UPDATE {SCHEMA}.ejercicios SET
                codigo_externo = NULL,
                nombre_original = NULL,
                equipamiento = NULL,
                musculos_secundarios = NULL,
                instrucciones = NULL,
                url_imagen = NULL,
                url_animacion = NULL,
                atribucion = NULL
            WHERE codigo_externo IS NOT NULL
              AND id_ejercicio IN (
                  SELECT DISTINCT id_ejercicio FROM {SCHEMA}.serie_fuerza
              )
            """
        )
    )

    conexion.execute(
        sa.text(
            f"""
            DELETE FROM {SCHEMA}.ejercicios
            WHERE codigo_externo IS NOT NULL
            """
        )
    )
