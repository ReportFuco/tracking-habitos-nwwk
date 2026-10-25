"""Herramientas MCP para detallar la boleta de una compra a partir de una foto.

Solo existen por MCP: el modelo conectado lee la foto que manda el usuario, la pasa a
líneas y las envía de una vez. Flujo: gastos_por_detallar para encontrar el gasto,
detallar_boleta con confirmar=false, mostrar el resumen y, con el visto bueno, confirmar.
"""
from typing import Annotated

from mcp.server.mcpserver import Context
from pydantic import Field
from sqlalchemy import select

from app.auth.scopes import FINANZAS_READ, FINANZAS_WRITE
from app.mcp.schemas import CategoriaMCP, GastosPorDetallarMCP, MovimientoMCP
from app.mcp.tools.finanzas import CREA, MODIFICA, SOLO_LECTURA, sesion_usuario
from app.models.usuario_auth import User
from app.schemas.finanzas import MAX_LINEAS_BOLETA, LineaBoleta, RevisionBoleta
from app.services.finanzas import boletas, categorias


async def gastos_por_detallar(
    ctx: Context,
    dias: Annotated[int, Field(ge=1, le=90, description="Cuántos días hacia atrás revisar.")] = 14,
    id_categoria: Annotated[
        int | None,
        Field(ge=1, description="Solo esta categoría. Sin ella, las que piden detalle (pedir_detalle en listar_categorias)."),
    ] = None,
    limit: Annotated[int, Field(ge=1, le=50)] = 20,
) -> GastosPorDetallarMCP:
    """Gastos recientes que todavía no tienen sus productos detallados, los más recientes
    primero. Úsala cuando el usuario mande la foto de una boleta para encontrar a qué gasto
    corresponde (por fecha y total). Si ninguno calza (pagó en efectivo u otra cuenta),
    registra el gasto con registrar_movimiento antes de detallarlo."""
    async with sesion_usuario(ctx) as (db, usuario):
        lista = await boletas.gastos_por_detallar(db, usuario, dias=dias, id_categoria=id_categoria, limit=limit)
        return GastosPorDetallarMCP(
            items=[MovimientoMCP.desde_modelo(movimiento) for movimiento in lista],
            comercios_usados=await boletas.comercios_usados(db, usuario),
        )


async def detallar_boleta(
    ctx: Context,
    id_movimiento: Annotated[int, Field(ge=1, description="Gasto de la boleta (ver gastos_por_detallar).")],
    lineas: Annotated[
        list[LineaBoleta],
        Field(
            min_length=1,
            max_length=MAX_LINEAS_BOLETA,
            description=(
                "Una por línea de producto de la boleta, en orden. Sin subtotales, total, vuelto, "
                "medios de pago ni el descuento al total. Si una oferta sale en su propia línea "
                "('DCTO', 'OFERTA'), réstala de la línea del producto como descuento."
            ),
        ),
    ],
    comercio: Annotated[
        str | None,
        Field(
            max_length=60,
            description="Cadena sin sucursal: 'Líder', 'Jumbo', 'Unimarc'. Úsalo igual que en comercios_usados.",
        ),
    ] = None,
    reemplazar: Annotated[
        bool,
        Field(description="true borra los productos que el gasto ya tenía y deja los de esta boleta."),
    ] = False,
    confirmar: Annotated[
        bool,
        Field(description="false (por defecto) solo revisa sin guardar; true guarda todo."),
    ] = False,
) -> RevisionBoleta:
    """Detalla en un gasto todos los productos de una boleta en una sola llamada.

    Cada línea se reconoce sola si el usuario ya compró ese texto en una boleta anterior o
    por su código de barra. Para las demás pasa id_producto (buscar_productos) o
    producto_nuevo con el nombre legible, marca, categoría y contenido; si ya existe uno
    igual se usa ese. Llámala primero con confirmar=false: muestra al usuario qué se
    reconoció, qué productos se crean y la diferencia con el monto del gasto; corrige las
    líneas sin_producto o invalida y, con su visto bueno, repítela igual con confirmar=true.
    """
    async with sesion_usuario(ctx, FINANZAS_WRITE if confirmar else FINANZAS_READ) as (db, usuario):
        es_admin = bool(await db.scalar(select(User.is_superuser).where(User.id == usuario.auth_user_id)))
        return await boletas.detallar_boleta(
            db,
            usuario,
            id_movimiento,
            lineas,
            comercio=comercio,
            reemplazar=reemplazar,
            confirmar=confirmar,
            es_admin=es_admin,
        )


async def pedir_detalle_categoria(
    ctx: Context,
    id_categoria: Annotated[int, Field(ge=1, description="Ver listar_categorias.")],
    pedir_detalle: Annotated[bool, Field(description="false deja de avisar en esta categoría.")] = True,
) -> CategoriaMCP:
    """Activa o apaga, solo para este usuario, el aviso Push que pide detallar la boleta
    cuando el Atajo de Wallet registra un gasto en esta categoría. Sin configurar, solo
    Supermercado avisa."""
    async with sesion_usuario(ctx, FINANZAS_WRITE) as (db, usuario):
        categoria = await categorias.fijar_pedir_detalle(db, usuario, id_categoria, pedir_detalle)
        return CategoriaMCP.desde_modelo(categoria)


HERRAMIENTAS = (
    (gastos_por_detallar, "Gastos por detallar", SOLO_LECTURA),
    (detallar_boleta, "Detallar boleta", CREA),
    (pedir_detalle_categoria, "Pedir detalle en una categoría", MODIFICA),
)
