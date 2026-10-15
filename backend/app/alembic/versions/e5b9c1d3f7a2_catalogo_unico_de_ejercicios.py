"""catalogo unico de ejercicios

Deja un solo catálogo de ejercicios: el del dataset.

1. Los ejercicios que el usuario había creado a mano antes de la importación quedaban
   duplicados junto a su equivalente del dataset ("Press banca con barra" y "Press de banca
   con barra"), y elegir uno u otro partía el historial en dos. Sus series pasan al
   ejercicio del dataset y la fila propia se borra. Un ejercicio propio sin equivalente
   conocido se borra sólo si no tiene series: nunca se pierde una serie registrada.

2. Aplica la curación de `app/alembic/data/ejercicios_dataset.json`: nombres traducidos de
   nuevo (la traducción original dejaba restos en inglés y frases repetidas), grupo
   muscular corregido (sentadillas y prensas pasan de glúteo a cuádriceps, pesos muertos
   rumanos a femoral) y la zona muscular de cada ejercicio, que la importación había dejado
   casi toda en "General".

3. Desactiva las subcategorías que quedaron sin ejercicios (vasto medial, semitendinoso...):
   un filtro que no devuelve nada parece un error.

Es idempotente y se resuelve por nombre y `codigo_externo`, no por id, porque los ids no
coinciden entre entornos.

Revision ID: e5b9c1d3f7a2
Revises: c3f7a9d1e5b2
Create Date: 2026-10-15 12:00:00.000000

"""

import json
import unicodedata
from pathlib import Path
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e5b9c1d3f7a2"
down_revision: Union[str, Sequence[str], None] = "c3f7a9d1e5b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


SCHEMA = "entrenamientos"
DATASET = Path(__file__).resolve().parent.parent / "data" / "ejercicios_dataset.json"

# nombre tal como lo escribió el usuario -> codigo_externo del ejercicio que lo reemplaza
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
    "Mariposa Pectoral": "0596",
    "Press militar con mancuerna": "0405",
    "Press militar con barra": "1457",
    "Elevaciones laterales": "0334",
    "Elevaciones frontales": "0310",
    "Deltoides trasero": "0602",
    "Curl de Biceps Martillo": "0313",
    "curl martillo cruzado": "0298",
    "Curl de Biceps Araña": "0454",
    "Curl de Biceps Araña con barra": "0454",
    "curl de bicep predicador en barra z": "1627",
    "press francés": "0060",
    "fondos en maquina": "1451",
    "extensión de tricep con polea alta": "0241",
    "Remo bajo con barra": "0180",
    "Jalón al pecho en maquina": "0579",
    "Remo sentado unilateral en maquina": "1313",
    "Press Pierna": "0739",
    "Elevación de talones en prensa": "1391",
}


def normalizar(valor: str) -> str:
    """Misma normalización que usa la búsqueda de la API: sin tildes y en minúsculas."""
    descompuesto = unicodedata.normalize("NFKD", valor.strip().lower())
    return "".join(char for char in descompuesto if not unicodedata.combining(char))


def _reemplazar_ejercicios_propios(conexion) -> None:
    equivalencias = {normalizar(nombre): codigo for nombre, codigo in EQUIVALENCIAS.items()}

    del_dataset = dict(
        conexion.execute(
            sa.text(
                f"SELECT codigo_externo, id_ejercicio FROM {SCHEMA}.ejercicios "
                "WHERE codigo_externo IS NOT NULL"
            )
        ).all()
    )

    propios = conexion.execute(
        sa.text(
            f"SELECT id_ejercicio, nombre FROM {SCHEMA}.ejercicios "
            "WHERE codigo_externo IS NULL"
        )
    ).all()

    for id_propio, nombre in propios:
        destino = del_dataset.get(equivalencias.get(normalizar(nombre)))
        if destino is None:
            continue
        conexion.execute(
            sa.text(
                f"UPDATE {SCHEMA}.serie_fuerza SET id_ejercicio = :destino "
                "WHERE id_ejercicio = :propio"
            ),
            {"destino": destino, "propio": id_propio},
        )

    conexion.execute(
        sa.text(
            f"""
            DELETE FROM {SCHEMA}.ejercicios e
            WHERE e.codigo_externo IS NULL
              AND NOT EXISTS (
                  SELECT 1 FROM {SCHEMA}.serie_fuerza s
                  WHERE s.id_ejercicio = e.id_ejercicio
              )
            """
        )
    )


def _aplicar_curacion(conexion) -> None:
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

    filas = []
    for registro in registros:
        clave = (registro["musculo"], registro["subcategoria"])
        if clave not in subcategorias:
            raise RuntimeError(f"Falta la subcategoría {clave[0]}/{clave[1]}")
        filas.append(
            {
                "codigo_externo": registro["codigo_externo"],
                "nombre": registro["nombre"],
                "id_subcategoria_musculo": subcategorias[clave],
                "equipamiento": registro["equipamiento"],
            }
        )

    conexion.execute(
        sa.text(
            f"""
            UPDATE {SCHEMA}.ejercicios SET
                nombre = :nombre,
                id_subcategoria_musculo = :id_subcategoria_musculo,
                equipamiento = :equipamiento
            WHERE codigo_externo = :codigo_externo
            """
        ),
        filas,
    )


def _activar_subcategorias_con_ejercicios(conexion) -> None:
    # "General" queda siempre activa: es la que se ofrece al crear un ejercicio a mano.
    conexion.execute(
        sa.text(
            f"""
            UPDATE {SCHEMA}.subcategoria_musculo s
            SET activo = (
                s.codigo = 'general'
                OR EXISTS (
                    SELECT 1 FROM {SCHEMA}.ejercicios e
                    WHERE e.id_subcategoria_musculo = s.id_subcategoria_musculo
                )
            )
            """
        )
    )


def upgrade() -> None:
    conexion = op.get_bind()
    _reemplazar_ejercicios_propios(conexion)
    _aplicar_curacion(conexion)
    _activar_subcategorias_con_ejercicios(conexion)


def downgrade() -> None:
    """Sólo vuelve a activar las subcategorías.

    Los ejercicios propios borrados y los nombres anteriores no se restauran: las series ya
    apuntan al ejercicio del dataset y volver a separarlas no tiene una respuesta correcta.
    """
    op.execute(sa.text(f"UPDATE {SCHEMA}.subcategoria_musculo SET activo = TRUE"))
