"""Herramientas MCP para ordenar las categorías: reglas por comercio y categorías ocultas."""
from datetime import date
from typing import Annotated

from mcp.server.mcpserver import Context
from pydantic import BaseModel, Field

from app.auth.scopes import FINANZAS_READ, FINANZAS_WRITE
from app.mcp.schemas import CategoriaMCP
from app.mcp.tools.finanzas import CREA, MODIFICA, SOLO_LECTURA, _validar, sesion_usuario
from app.schemas.finanzas import (
    AplicarReglasRequest,
    AplicarReglasResponse,
    MoverMovimientosResponse,
    ReglaCategoriaCreate,
    ReglaCategoriaResponse,
)
from app.services.finanzas import categorias, reglas


class ReglasMCP(BaseModel):
    items: list[ReglaCategoriaResponse]


async def listar_reglas_categoria(ctx: Context) -> ReglasMCP:
    """Reglas que asignan categoría según la descripción: si la glosa o el nombre del
    comercio contiene el patrón (sin distinguir mayúsculas ni tildes), el movimiento va a esa
    categoría. Se aplican al registrar sin categoría o como «Otros» (como hace el Atajo de
    Wallet) y a las filas de cartola sin categoría."""
    async with sesion_usuario(ctx) as (db, usuario):
        return ReglasMCP(items=await reglas.listar_reglas(db, usuario))


async def guardar_reglas_categoria(
    ctx: Context,
    reglas_nuevas: Annotated[
        list[ReglaCategoriaCreate],
        Field(
            min_length=1,
            max_length=200,
            description=(
                "Patrón (3 caracteres o más, ej. 'TOTTUS', 'UBER EATS') e id_categoria. Si el "
                "patrón ya existe, se le cambia la categoría. Si calzan varios, gana el más largo."
            ),
        ),
    ],
) -> ReglasMCP:
    """Crea o actualiza reglas de categoría. Propónlas a partir de los comercios que se
    repiten en buscar_movimientos y confírmalas con el usuario antes de guardarlas."""
    async with sesion_usuario(ctx, FINANZAS_WRITE) as (db, usuario):
        return ReglasMCP(items=await reglas.guardar_reglas(db, usuario, reglas_nuevas))


async def eliminar_regla_categoria(
    ctx: Context,
    id_regla: Annotated[int, Field(ge=1, description="Ver listar_reglas_categoria.")],
) -> ReglasMCP:
    """Elimina una regla. Los movimientos ya categorizados no cambian. Devuelve las que quedan."""
    async with sesion_usuario(ctx, FINANZAS_WRITE) as (db, usuario):
        await reglas.eliminar_regla(db, usuario, id_regla)
        return ReglasMCP(items=await reglas.listar_reglas(db, usuario))


async def aplicar_reglas_categoria(
    ctx: Context,
    confirmar: Annotated[
        bool, Field(description="false (por defecto) solo muestra qué cambiaría; true lo aplica.")
    ] = False,
    desde: Annotated[date | None, Field(description="Desde este día, incluido.")] = None,
    hasta: Annotated[date | None, Field(description="Hasta este día, incluido.")] = None,
    solo_desde_categorias: Annotated[
        list[int] | None,
        Field(
            description=(
                "Solo cambia movimientos que hoy están en estas categorías (ej. las que se van a "
                "ocultar), para no pisar las que el usuario eligió a propósito."
            ),
        ),
    ] = None,
) -> AplicarReglasResponse:
    """Recategoriza movimientos ya registrados según las reglas, agrupando los cambios por
    categoría de origen y destino. Llámala primero con confirmar=false, muestra el resumen al
    usuario y solo con su visto bueno repítela con confirmar=true. Omite transferencias y
    abonos a deudas."""
    data = _validar(
        AplicarReglasRequest,
        desde=desde,
        hasta=hasta,
        solo_desde_categorias=solo_desde_categorias,
        confirmar=confirmar,
    )
    async with sesion_usuario(ctx, FINANZAS_WRITE if confirmar else FINANZAS_READ) as (db, usuario):
        return await reglas.aplicar_reglas(db, usuario, data)


async def ocultar_categoria(
    ctx: Context,
    id_categoria: Annotated[int, Field(ge=1, description="Ver listar_categorias.")],
    oculta: Annotated[bool, Field(description="false la vuelve a mostrar.")] = True,
) -> CategoriaMCP:
    """Oculta una categoría solo para este usuario: deja de ofrecerse al registrar y en las
    metas. Sirve para las por defecto, que no puede archivar. Sus movimientos no cambian;
    para moverlos usa aplicar_reglas_categoria o editar_movimiento."""
    async with sesion_usuario(ctx, FINANZAS_WRITE) as (db, usuario):
        categoria = await categorias.ocultar_categoria(db, usuario, id_categoria, oculta)
        return CategoriaMCP.desde_modelo(categoria)


async def mover_movimientos_categoria(
    ctx: Context,
    id_categoria_origen: Annotated[int, Field(ge=1, description="Ver listar_categorias.")],
    id_categoria_destino: Annotated[int, Field(ge=1, description="Ver listar_categorias.")],
    confirmar: Annotated[
        bool, Field(description="false (por defecto) solo cuenta cuántos se moverían; true los mueve.")
    ] = False,
) -> MoverMovimientosResponse:
    """Pasa todos los movimientos del usuario de una categoría a otra, para fusionarlas (ej.
    lo que quedó en una categoría antes de ocultarla). Primero con confirmar=false para
    mostrar cuántos y cuánto suman; con el visto bueno del usuario, confirmar=true."""
    async with sesion_usuario(ctx, FINANZAS_WRITE if confirmar else FINANZAS_READ) as (db, usuario):
        return await categorias.mover_movimientos(
            db, usuario, id_categoria_origen, id_categoria_destino, confirmar=confirmar
        )


HERRAMIENTAS = (
    (mover_movimientos_categoria, "Mover movimientos de categoría", MODIFICA),
    (listar_reglas_categoria, "Listar reglas de categoría", SOLO_LECTURA),
    (guardar_reglas_categoria, "Guardar reglas de categoría", CREA),
    (eliminar_regla_categoria, "Eliminar regla de categoría", MODIFICA),
    (aplicar_reglas_categoria, "Aplicar reglas de categoría", MODIFICA),
    (ocultar_categoria, "Ocultar categoría", MODIFICA),
)
