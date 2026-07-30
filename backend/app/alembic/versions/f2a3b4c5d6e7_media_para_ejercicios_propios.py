"""media para ejercicios propios

La importación del catálogo (`d0e1f2a3b4c5`) enriquece un ejercicio ya existente sólo si el
nombre coincide exacto una vez normalizado. Los ejercicios que el usuario había creado a
mano quedaron fuera por diferencias de redacción -- "Press banca con barra" contra "Press
de banca con barra" -- y son justo los que tienen series registradas, así que en la
práctica el entreno activo mostraba el icono de relleno en el 100% de los casos.

Esta migración copia imagen, animación e instrucciones desde la fila del dataset hacia el
ejercicio propio equivalente. El `id_ejercicio` no se toca: las series ya registradas
apuntan a él.

El mapeo va por nombre y no por id porque los ids no coinciden entre entornos.

Sólo entran las equivalencias inequívocas. Los ejercicios cuyo nombre admite más de una
lectura ("Remo bajo con barra", "Deltoides trasero") se dejan sin media a propósito: una
animación equivocada enseña el movimiento equivocado, que es peor que no mostrar ninguna.

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2026-07-30 19:20:00.000000

"""

import json
import unicodedata
from pathlib import Path
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f2a3b4c5d6e7"
down_revision: Union[str, Sequence[str], None] = "e1f2a3b4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


SCHEMA = "entrenamientos"
DATASET = Path(__file__).resolve().parent.parent / "data" / "ejercicios_dataset.json"

# nombre tal como lo escribió el usuario -> codigo_externo del dataset
EQUIVALENCIAS = {
    "Press banca con mancuerna": "0289",
    "Press banca con barra": "0025",
    "Press banca inclinada con mancuerna": "0314",
    "Press banca inclinada con barra": "0047",
    "Aperturas con mancuerna en banco plano": "0308",
    "Aperturas con mancuerna en banco inclinado": "0319",
    "Aperturas en polea alta": "0227",
    "Aperturas en polea media": "0188",
    "Aperturas en polea baja": "0179",
    "Máquina prensa pecho": "0577",
    "Press militar con mancuerna": "0405",
    "Press militar con barra": "1457",
    "Elevaciones laterales": "0334",
    "Elevaciones frontales": "0310",
    "Curl de Biceps Martillo": "0313",
    "Curl de Biceps Araña con barra": "0454",
    "press francés": "0060",
    "fondos en maquina": "1451",
    "extensión de tricep con polea alta": "0241",
    "Jalón al pecho en maquina": "0579",
    "Remo sentado unilateral en maquina": "1313",
    "curl martillo cruzado": "0298",
}


def normalizar(valor: str) -> str:
    """Misma normalización que usa la búsqueda de la API: sin tildes y en minúsculas."""
    descompuesto = unicodedata.normalize("NFKD", valor.strip().lower())
    return "".join(char for char in descompuesto if not unicodedata.combining(char))


def upgrade() -> None:
    conexion = op.get_bind()
    registros = {
        registro["codigo_externo"]: registro
        for registro in json.loads(DATASET.read_text(encoding="utf-8"))
    }

    # Un ejercicio propio puede tener el nombre escrito con otro espaciado o acentuación,
    # así que se resuelve contra la tabla por nombre normalizado en vez de por igualdad.
    propios = {
        normalizar(nombre): id_ejercicio
        for id_ejercicio, nombre in conexion.execute(
            sa.text(
                f"""
                SELECT id_ejercicio, nombre
                FROM {SCHEMA}.ejercicios
                WHERE codigo_externo IS NULL AND url_imagen IS NULL
                """
            )
        )
    }

    actualizaciones = []
    for nombre_propio, codigo in EQUIVALENCIAS.items():
        id_ejercicio = propios.get(normalizar(nombre_propio))
        origen = registros.get(codigo)

        # Ni el ejercicio propio ni el código son obligatorios: otro entorno puede no tener
        # esa fila, o puede haber corrido ya esta migración. En ambos casos se salta.
        if id_ejercicio is None or origen is None:
            continue

        actualizaciones.append(
            {
                "id_ejercicio": id_ejercicio,
                "url_imagen": origen["url_imagen"],
                "url_animacion": origen["url_animacion"],
                "instrucciones": json.dumps(origen["instrucciones"], ensure_ascii=False),
                "musculos_secundarios": json.dumps(
                    origen["musculos_secundarios"], ensure_ascii=False
                ),
                "equipamiento": origen["equipamiento"],
                "nombre_original": origen["nombre_original"],
                # La licencia del material exige mostrar la atribución donde se use, así que
                # viaja junto con la imagen y no por separado.
                "atribucion": origen["atribucion"],
            }
        )

    if not actualizaciones:
        return

    conexion.execute(
        sa.text(
            f"""
            UPDATE {SCHEMA}.ejercicios SET
                url_imagen = :url_imagen,
                url_animacion = :url_animacion,
                instrucciones = CAST(:instrucciones AS jsonb),
                musculos_secundarios = CAST(:musculos_secundarios AS jsonb),
                equipamiento = COALESCE(equipamiento, :equipamiento),
                nombre_original = COALESCE(nombre_original, :nombre_original),
                atribucion = :atribucion
            WHERE id_ejercicio = :id_ejercicio
            """
        ),
        actualizaciones,
    )


def downgrade() -> None:
    """Devuelve a NULL sólo el material prestado, no el de los ejercicios importados."""
    conexion = op.get_bind()

    conexion.execute(
        sa.text(
            f"""
            UPDATE {SCHEMA}.ejercicios SET
                url_imagen = NULL,
                url_animacion = NULL,
                instrucciones = NULL,
                musculos_secundarios = NULL,
                nombre_original = NULL,
                atribucion = NULL
            WHERE codigo_externo IS NULL AND url_imagen IS NOT NULL
            """
        )
    )
