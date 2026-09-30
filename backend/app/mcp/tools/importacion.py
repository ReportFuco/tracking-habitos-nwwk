"""Herramientas MCP para cargar movimientos en lote desde una cartola bancaria.

Solo existen por MCP: el modelo conectado lee el Excel que sube el usuario (cada banco
tiene columnas distintas), lo normaliza a filas y las envía. Flujo: previsualizar,
confirmar con el usuario, importar; y deshacer si algo salió mal.
"""
from typing import Annotated

from mcp.server.mcpserver import Context
from pydantic import Field

from app.auth.scopes import FINANZAS_WRITE
from app.mcp.schemas import ImportacionDeshechaMCP
from app.mcp.tools.finanzas import CREA, MODIFICA, SOLO_LECTURA, sesion_usuario
from app.schemas.finanzas import (
    MAX_FILAS_IMPORTACION,
    FilaImportacion,
    ImportacionesLista,
    PrevisualizacionImportacion,
    ResultadoImportacion,
)
from app.services.finanzas import importacion


IdCuenta = Annotated[
    int,
    Field(ge=1, description="Cuenta de la cartola (ver listar_cuentas). Una llamada por cuenta."),
]
Filas = Annotated[
    list[FilaImportacion],
    Field(
        min_length=1,
        max_length=MAX_FILAS_IMPORTACION,
        description=(
            f"Movimientos de la cartola normalizados, hasta {MAX_FILAS_IMPORTACION} por llamada. "
            "Envía la misma lista (mismo orden) a previsualizar_importacion y a importar_movimientos."
        ),
    ),
]


async def previsualizar_importacion(ctx: Context, id_cuenta: IdCuenta, filas: Filas) -> PrevisualizacionImportacion:
    """Revisa una cartola normalizada sin guardar nada: cuántas filas son nuevas, cuáles ya
    se importaron antes, cuáles parecen duplicar un movimiento registrado a mano y cuáles
    son inválidas (categoría o deuda que no corresponde). Úsala siempre antes de
    importar_movimientos y muéstrale el resumen al usuario.
    """
    async with sesion_usuario(ctx) as (db, usuario):
        return await importacion.previsualizar(db, usuario, id_cuenta, filas)


async def importar_movimientos(
    ctx: Context,
    id_cuenta: IdCuenta,
    filas: Filas,
    nombre: Annotated[
        str | None,
        Field(max_length=160, description="Para reconocerla después, ej. 'Cartola BCI cuenta corriente sept 2026'."),
    ] = None,
    confirmar_duplicados: Annotated[
        list[int] | None,
        Field(
            description=(
                "Índices de filas marcadas 'posible_duplicado' que el usuario confirmó que son "
                "movimientos distintos y sí deben importarse. El resto de posibles duplicados se omite."
            ),
        ),
    ] = None,
) -> ResultadoImportacion:
    """Importa la cartola en una sola transacción: si alguna fila es inválida no se crea
    nada. Omite las filas ya importadas y los posibles duplicados no confirmados. Llámala
    solo después de previsualizar_importacion y de que el usuario apruebe el resumen.
    """
    async with sesion_usuario(ctx, FINANZAS_WRITE) as (db, usuario):
        return await importacion.importar(
            db, usuario, id_cuenta, filas, nombre=nombre, confirmar_duplicados=confirmar_duplicados
        )


async def listar_importaciones(
    ctx: Context,
    limit: Annotated[int, Field(ge=1, le=50)] = 20,
) -> ImportacionesLista:
    """Cargas masivas anteriores, de la más reciente a la más antigua, con su cuenta, rango
    de fechas y cuántos de sus movimientos siguen existiendo."""
    async with sesion_usuario(ctx) as (db, usuario):
        return await importacion.listar_importaciones(db, usuario, limit)


async def deshacer_importacion(
    ctx: Context,
    id_importacion: Annotated[int, Field(ge=1)],
) -> ImportacionDeshechaMCP:
    """Elimina todos los movimientos que creó una importación (incluidos los que se
    editaron después). No se puede deshacer: confirma con el usuario antes de llamarla."""
    async with sesion_usuario(ctx, FINANZAS_WRITE) as (db, usuario):
        borrados = await importacion.deshacer_importacion(db, usuario, id_importacion)
        return ImportacionDeshechaMCP(id_importacion=id_importacion, movimientos_eliminados=borrados)


HERRAMIENTAS = (
    (previsualizar_importacion, "Previsualizar importación de cartola", SOLO_LECTURA),
    (importar_movimientos, "Importar movimientos de cartola", CREA),
    (listar_importaciones, "Listar importaciones", SOLO_LECTURA),
    (deshacer_importacion, "Deshacer importación", MODIFICA),
)
