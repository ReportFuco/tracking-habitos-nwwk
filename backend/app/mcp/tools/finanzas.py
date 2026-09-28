"""Herramientas MCP de solo lectura del modulo de finanzas.

Cada herramienta abre su propia sesion de BD, resuelve el perfil del usuario autenticado
y delega en app.services.finanzas: la misma logica que usa la API REST.
"""
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated, Literal

from mcp.server.mcpserver import Context, MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from mcp.types import ToolAnnotations
from pydantic import Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.mcp.auth import SCOPE_AUTH_USER_ID
from app.mcp.schemas import (
    CategoriaMCP,
    CategoriasMCP,
    CuentaMCP,
    CuentasMCP,
    MovimientoMCP,
    MovimientosMCP,
)
from app.models import Usuario
from app.models.finanzas import EnumTipoMovimiento
from app.schemas.finanzas import (
    AnaliticaDiariaResponse,
    AnaliticaDistribucionCategoriasResponse,
    AnaliticaDistribucionCuentasResponse,
    AnaliticaResumenResponse,
    AnaliticaTendenciaMensualResponse,
)
from app.services.errores import ErrorDominio
from app.services.finanzas import analitica, categorias, cuentas, movimientos
from app.services.usuarios import obtener_perfil


SOLO_LECTURA = ToolAnnotations(
    read_only_hint=True,
    idempotent_hint=True,
    open_world_hint=False,
)

Anio = Annotated[
    int | None,
    Field(ge=2000, le=2100, description="Año del periodo. Si se omite, el año actual en Chile."),
]
Mes = Annotated[
    int | None,
    Field(ge=1, le=12, description="Mes del periodo (1-12). Si se omite, el mes actual en Chile."),
]
TipoMovimiento = Literal["gasto", "ingreso"]


@asynccontextmanager
async def sesion_usuario(ctx: Context) -> AsyncIterator[tuple[AsyncSession, Usuario]]:
    request = ctx.request_context.request
    auth_user_id = request.scope.get(SCOPE_AUTH_USER_ID) if request is not None else None
    if auth_user_id is None:
        raise ToolError("Solicitud sin usuario autenticado.")

    async with AsyncSessionLocal() as db:
        try:
            usuario = await obtener_perfil(db, auth_user_id)
            yield db, usuario
        except ErrorDominio as exc:
            raise ToolError(exc.mensaje) from exc


async def listar_cuentas(ctx: Context) -> CuentasMCP:
    """Cuentas activas del usuario (id, nombre, producto y banco).

    Úsala para traducir el nombre de una cuenta ("la débito", "la tarjeta de crédito")
    a su id_cuenta antes de filtrar movimientos.
    """
    async with sesion_usuario(ctx) as (db, usuario):
        items = await cuentas.listar_cuentas(db, usuario, solo_activas=True)
        return CuentasMCP(items=[CuentaMCP.desde_modelo(cuenta) for cuenta in items])


async def listar_categorias(ctx: Context) -> CategoriasMCP:
    """Categorías de movimientos disponibles (id y nombre). Son compartidas entre usuarios."""
    async with sesion_usuario(ctx) as (db, _usuario):
        items = await categorias.listar_categorias(db)
        return CategoriasMCP(items=[CategoriaMCP.desde_modelo(categoria) for categoria in items])


async def buscar_movimientos(
    ctx: Context,
    year: Anio = None,
    month: Annotated[
        int | None,
        Field(ge=1, le=12, description="Mes (1-12). Sin year usa el año actual. Sin month ni year no filtra por fecha."),
    ] = None,
    tipo_movimiento: Annotated[TipoMovimiento | None, Field(description="Filtra gastos o ingresos.")] = None,
    id_categoria: Annotated[int | None, Field(ge=1, description="Ver listar_categorias.")] = None,
    id_cuenta: Annotated[int | None, Field(ge=1, description="Ver listar_cuentas.")] = None,
    texto: Annotated[
        str | None,
        Field(min_length=1, max_length=100, description="Busca en la descripción y en el nombre de la categoría."),
    ] = None,
    limit: Annotated[int, Field(ge=1, le=100, description="Máximo de movimientos a devolver.")] = 30,
    offset: Annotated[int, Field(ge=0, description="Movimientos a omitir, para paginar.")] = 0,
) -> MovimientosMCP:
    """Lista movimientos del usuario, del más reciente al más antiguo, con filtros opcionales.

    Para totales o comparaciones entre meses es mejor resumen_mes o las distribuciones:
    ya vienen agregadas y no requieren paginar.
    """
    async with sesion_usuario(ctx) as (db, usuario):
        # Se pide uno extra para saber si hay otra pagina sin contar el total.
        items = await movimientos.listar_movimientos(
            db,
            usuario,
            offset=offset,
            limit=limit + 1,
            year=year,
            month=month,
            tipo_movimiento=EnumTipoMovimiento(tipo_movimiento) if tipo_movimiento else None,
            id_categoria=id_categoria,
            id_cuenta=id_cuenta,
            q=texto,
        )
        return MovimientosMCP(
            items=[MovimientoMCP.desde_modelo(movimiento) for movimiento in items[:limit]],
            offset=offset,
            limit=limit,
            hay_mas=len(items) > limit,
        )


async def resumen_mes(ctx: Context, year: Anio = None, month: Mes = None) -> AnaliticaResumenResponse:
    """Resumen de un mes: gasto, ingreso, balance, gasto fijo vs variable, ticket promedio,
    tasa de ahorro, variación del gasto contra el mes anterior y, solo para el mes en curso,
    la proyección de gasto a fin de mes.
    """
    async with sesion_usuario(ctx) as (db, usuario):
        return await analitica.resumen_financiero(db, usuario, year, month)


async def tendencia_mensual(
    ctx: Context,
    meses: Annotated[int, Field(ge=1, le=24, description="Cantidad de meses hacia atrás, incluido el actual.")] = 6,
) -> AnaliticaTendenciaMensualResponse:
    """Gasto, ingreso y balance de los últimos N meses, del más antiguo al más reciente."""
    async with sesion_usuario(ctx) as (db, usuario):
        return await analitica.tendencia_mensual(db, usuario, meses)


async def distribucion_por_categoria(
    ctx: Context,
    year: Anio = None,
    month: Mes = None,
    tipo_movimiento: TipoMovimiento = "gasto",
) -> AnaliticaDistribucionCategoriasResponse:
    """Total y porcentaje por categoría en un mes, ordenado de mayor a menor."""
    async with sesion_usuario(ctx) as (db, usuario):
        return await analitica.distribucion_categorias(
            db, usuario, year, month, EnumTipoMovimiento(tipo_movimiento)
        )


async def distribucion_por_cuenta(
    ctx: Context,
    year: Anio = None,
    month: Mes = None,
    tipo_movimiento: TipoMovimiento = "gasto",
) -> AnaliticaDistribucionCuentasResponse:
    """Total y porcentaje por cuenta en un mes, ordenado de mayor a menor."""
    async with sesion_usuario(ctx) as (db, usuario):
        return await analitica.distribucion_cuentas(
            db, usuario, year, month, EnumTipoMovimiento(tipo_movimiento)
        )


async def gasto_diario(ctx: Context, year: Anio = None, month: Mes = None) -> AnaliticaDiariaResponse:
    """Gasto e ingreso de cada día de un mes, promedio diario y el día de mayor gasto.

    El promedio se calcula sobre los días transcurridos; los días posteriores a hoy vienen
    con es_futuro=true.
    """
    async with sesion_usuario(ctx) as (db, usuario):
        return await analitica.analitica_diaria(db, usuario, year, month)


HERRAMIENTAS = (
    (listar_cuentas, "Listar cuentas"),
    (listar_categorias, "Listar categorías"),
    (buscar_movimientos, "Buscar movimientos"),
    (resumen_mes, "Resumen del mes"),
    (tendencia_mensual, "Tendencia mensual"),
    (distribucion_por_categoria, "Gasto por categoría"),
    (distribucion_por_cuenta, "Gasto por cuenta"),
    (gasto_diario, "Gasto diario"),
)


def registrar_herramientas_finanzas(servidor: MCPServer) -> None:
    for funcion, titulo in HERRAMIENTAS:
        servidor.add_tool(funcion, title=titulo, annotations=SOLO_LECTURA)
