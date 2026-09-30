"""Herramientas MCP del modulo de finanzas.

Cada herramienta exige un scope de la API key, abre su propia sesion de BD, resuelve el
perfil del usuario autenticado y delega en app.services.finanzas: la misma logica que usa
la API REST.
"""
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID
from zoneinfo import ZoneInfo

from mcp.server.mcpserver import Context, MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from mcp.types import ToolAnnotations
from pydantic import Field, ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.scopes import FINANZAS_READ, FINANZAS_WRITE, tiene_scope
from app.db.session import AsyncSessionLocal
from app.mcp.auth import SCOPE_API_KEY_SCOPES, SCOPE_AUTH_USER_ID
from app.mcp.schemas import (
    CategoriaMCP,
    CategoriasMCP,
    CuentaMCP,
    CuentasMCP,
    MovimientoEliminadoMCP,
    MovimientoMCP,
    MovimientosMCP,
    ProductoMCP,
    ProductosMCP,
)
from app.models import Usuario
from app.models.usuario_auth import User
from app.models.finanzas import EnumTipoMovimiento
from app.schemas.finanzas import (
    AnaliticaDiariaResponse,
    AnaliticaDistribucionCategoriasResponse,
    AnaliticaDistribucionCuentasResponse,
    AnaliticaResumenResponse,
    AnaliticaTendenciaMensualResponse,
    CategoriaCreate,
    MovimientoCreate,
    MovimientoItemCreate,
    MovimientoPatch,
)
from app.schemas.catalogo import ProductoCreate
from app.services.catalogo import productos
from app.services.errores import ErrorDominio
from app.services.finanzas import analitica, categorias, cuentas, items, movimientos
from app.services.usuarios import obtener_perfil


CHILE_TZ = ZoneInfo("America/Santiago")

SOLO_LECTURA = ToolAnnotations(
    read_only_hint=True,
    idempotent_hint=True,
    open_world_hint=False,
)
CREA = ToolAnnotations(
    read_only_hint=False,
    destructive_hint=False,
    idempotent_hint=False,
    open_world_hint=False,
)
# Editar y borrar pisan datos existentes: los clientes suelen pedir confirmacion.
MODIFICA = ToolAnnotations(
    read_only_hint=False,
    destructive_hint=True,
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
TipoGasto = Literal["variable", "fijo"]
Fecha = Annotated[
    datetime | None,
    Field(description="Fecha y hora del movimiento en hora de Chile, ej. 2026-09-27T13:30:00."),
]


@asynccontextmanager
async def sesion_usuario(
    ctx: Context,
    scope_requerido: str = FINANZAS_READ,
) -> AsyncIterator[tuple[AsyncSession, Usuario]]:
    """Sesion de BD con el perfil del usuario de la key. Confirma la transaccion al salir."""
    request = ctx.request_context.request
    request_scope = request.scope if request is not None else {}
    auth_user_id = request_scope.get(SCOPE_AUTH_USER_ID)
    if auth_user_id is None:
        raise ToolError("Solicitud sin usuario autenticado.")
    if not tiene_scope(request_scope.get(SCOPE_API_KEY_SCOPES), scope_requerido):
        raise ToolError(
            f"Esta conexion no tiene el permiso {scope_requerido}. "
            "El usuario puede crear una nueva con ese permiso en Ritmo > Perfil > Conexiones con IA."
        )

    async with AsyncSessionLocal() as db:
        try:
            usuario = await obtener_perfil(db, auth_user_id)
            yield db, usuario
            await db.commit()
        except ErrorDominio as exc:
            raise ToolError(exc.mensaje) from exc


def _fecha_chile(fecha: datetime | None) -> datetime | None:
    """created_at es naive en hora de Chile: una fecha con zona se convierte y se le quita."""
    if fecha is None or fecha.tzinfo is None:
        return fecha
    return fecha.astimezone(CHILE_TZ).replace(tzinfo=None)


def _validar(modelo, **datos):
    try:
        return modelo(**datos)
    except ValidationError as exc:
        errores = "; ".join(error["msg"] for error in exc.errors())
        raise ToolError(f"Datos inválidos: {errores}") from exc


async def listar_cuentas(ctx: Context) -> CuentasMCP:
    """Cuentas activas del usuario (id, nombre, producto y banco).

    Úsala para traducir el nombre de una cuenta ("la débito", "la tarjeta de crédito")
    a su id_cuenta antes de filtrar o registrar movimientos.
    """
    async with sesion_usuario(ctx) as (db, usuario):
        items = await cuentas.listar_cuentas(db, usuario, solo_activas=True)
        return CuentasMCP(items=[CuentaMCP.desde_modelo(cuenta) for cuenta in items])


async def listar_categorias(ctx: Context) -> CategoriasMCP:
    """Categorías que el usuario puede usar: las por defecto y las que creó él (es_propia).

    Si ninguna calza con lo que el usuario describe, propónle crear una con crear_categoria.
    """
    async with sesion_usuario(ctx) as (db, usuario):
        lista = await categorias.listar_categorias(db, usuario)
        return CategoriasMCP(items=[CategoriaMCP.desde_modelo(categoria) for categoria in lista])


async def crear_categoria(
    ctx: Context,
    nombre: Annotated[str, Field(min_length=1, max_length=100, description="Ej. 'Mascotas'.")],
) -> CategoriaMCP:
    """Crea una categoría propia del usuario (solo él la ve). Falla si ya existe una con el
    mismo nombre entre las por defecto o las suyas. Confírmala con el usuario antes."""
    data = _validar(CategoriaCreate, nombre=nombre)
    async with sesion_usuario(ctx, FINANZAS_WRITE) as (db, usuario):
        categoria = await categorias.crear_categoria(db, usuario, data)
        return CategoriaMCP.desde_modelo(categoria)


async def buscar_productos(
    ctx: Context,
    texto: Annotated[
        str | None,
        Field(max_length=100, description="Nombre, marca o código de barra. Sin texto: los que más compra el usuario."),
    ] = None,
    limit: Annotated[int, Field(ge=1, le=50)] = 15,
) -> ProductosMCP:
    """Busca productos del catálogo (aprobados y los que propuso el usuario) para
    detallarlos en un gasto con agregar_producto_a_gasto."""
    async with sesion_usuario(ctx) as (db, usuario):
        if texto and texto.strip():
            lista = await productos.buscar_productos(db, usuario, q=texto, limit=limit)
        else:
            lista = await productos.productos_frecuentes(db, usuario, limit)
        return ProductosMCP(items=[ProductoMCP.desde_modelo(producto) for producto in lista])


async def crear_producto(
    ctx: Context,
    nombre: Annotated[str, Field(min_length=1, max_length=160, description="Ej. 'Leche entera Colun'.")],
    contenido_neto: Annotated[float | None, Field(gt=0, description="Ej. 1 para 1 L.")] = None,
    unidad_contenido: Annotated[str | None, Field(max_length=30, description="g, kg, ml, L, unidades...")] = None,
    formato: Annotated[str | None, Field(max_length=100, description="Ej. 'Caja', 'Botella'.")] = None,
    codigo_barra: Annotated[str | None, Field(max_length=64)] = None,
) -> ProductoMCP:
    """Agrega un producto al catálogo cuando buscar_productos no lo encuentra. Solo para
    administradores; a un usuario normal, sugiérele pedirle a un administrador que lo agregue."""
    data = _validar(
        ProductoCreate,
        nombre_producto=nombre,
        contenido_neto=contenido_neto,
        unidad_contenido=unidad_contenido,
        formato=formato,
        codigo_barra=codigo_barra,
    )
    async with sesion_usuario(ctx, FINANZAS_WRITE) as (db, usuario):
        es_admin = await db.scalar(select(User.is_superuser).where(User.id == usuario.auth_user_id))
        if not es_admin:
            raise ToolError("Solo un administrador puede agregar productos al catálogo.")
        producto = await productos.crear_producto(db, usuario, data, es_admin=True)
        return ProductoMCP.desde_modelo(producto)


async def agregar_producto_a_gasto(
    ctx: Context,
    id_movimiento: Annotated[int, Field(ge=1, description="Gasto al que se agrega el producto.")],
    id_producto: Annotated[int, Field(ge=1, description="Ver buscar_productos.")],
    cantidad: Annotated[float, Field(gt=0, description="Unidades, o kilos/litros a granel (ej. 0.75).")] = 1,
    precio_total: Annotated[
        int | None,
        Field(ge=0, description="CLP pagados por la línea completa (cantidad × precio unitario)."),
    ] = None,
) -> MovimientoMCP:
    """Detalla un producto comprado dentro de un gasto. El detalle puede ser parcial: no hace
    falta que los productos sumen el monto del gasto."""
    data = _validar(
        MovimientoItemCreate,
        id_producto=id_producto,
        cantidad=str(cantidad),
        precio_total=precio_total,
    )
    async with sesion_usuario(ctx, FINANZAS_WRITE) as (db, usuario):
        movimiento = await items.agregar_item(db, usuario, id_movimiento, data)
        return MovimientoMCP.desde_modelo(movimiento)


async def quitar_producto_de_gasto(
    ctx: Context,
    id_movimiento: Annotated[int, Field(ge=1)],
    id_item: Annotated[int, Field(ge=1, description="id_item dentro de productos del movimiento.")],
) -> MovimientoMCP:
    """Quita un producto detallado de un gasto. El gasto no cambia."""
    async with sesion_usuario(ctx, FINANZAS_WRITE) as (db, usuario):
        movimiento = await items.eliminar_item(db, usuario, id_movimiento, id_item)
        return MovimientoMCP.desde_modelo(movimiento)


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


async def registrar_movimiento(
    ctx: Context,
    tipo_movimiento: TipoMovimiento,
    monto: Annotated[int, Field(gt=0, description="Monto en CLP, entero y positivo (ej. 5990).")],
    id_categoria: Annotated[int, Field(ge=1, description="Ver listar_categorias.")],
    id_cuenta: Annotated[int, Field(ge=1, description="Ver listar_cuentas.")],
    tipo_gasto: Annotated[
        TipoGasto,
        Field(description="'fijo' para gastos recurrentes (arriendo, planes); si no, 'variable'."),
    ] = "variable",
    descripcion: Annotated[str | None, Field(max_length=250, description="Detalle breve, ej. 'Almuerzo'.")] = None,
    fecha: Fecha = None,
    client_request_id: Annotated[
        UUID | None,
        Field(
            description=(
                "UUID generado por ti para este movimiento. Si repites la llamada con el mismo "
                "valor (por ejemplo tras un error de red) no se duplica."
            ),
        ),
    ] = None,
) -> MovimientoMCP:
    """Registra un gasto o ingreso del usuario. Sin fecha, usa el momento actual.

    Resuelve los ids con listar_cuentas y listar_categorias, y si hay dudas sobre el monto,
    la cuenta o la categoría, confírmalas con el usuario antes de registrar.
    """
    data = _validar(
        MovimientoCreate,
        client_request_id=client_request_id,
        id_categoria=id_categoria,
        id_cuenta=id_cuenta,
        tipo_movimiento=tipo_movimiento,
        tipo_gasto=tipo_gasto,
        monto=monto,
        descripcion=descripcion,
        created_at=_fecha_chile(fecha),
    )
    async with sesion_usuario(ctx, FINANZAS_WRITE) as (db, usuario):
        movimiento = await movimientos.crear_movimiento(db, usuario, data)
        return MovimientoMCP.desde_modelo(movimiento)


async def editar_movimiento(
    ctx: Context,
    id_movimiento: Annotated[int, Field(ge=1)],
    monto: Annotated[int | None, Field(gt=0, description="Nuevo monto en CLP.")] = None,
    tipo_movimiento: TipoMovimiento | None = None,
    tipo_gasto: TipoGasto | None = None,
    id_categoria: Annotated[int | None, Field(ge=1)] = None,
    id_cuenta: Annotated[int | None, Field(ge=1)] = None,
    descripcion: Annotated[
        str | None,
        Field(max_length=250, description="Nueva descripción. Un texto vacío la borra."),
    ] = None,
    fecha: Fecha = None,
) -> MovimientoMCP:
    """Modifica un movimiento existente del usuario. Solo cambia los campos que se envían."""
    cambios = {
        "monto": monto,
        "tipo_movimiento": tipo_movimiento,
        "tipo_gasto": tipo_gasto,
        "id_categoria": id_categoria,
        "id_cuenta": id_cuenta,
        "created_at": _fecha_chile(fecha),
    }
    cambios = {campo: valor for campo, valor in cambios.items() if valor is not None}
    if descripcion is not None:
        cambios["descripcion"] = descripcion.strip() or None
    if not cambios:
        raise ToolError("Indica al menos un campo a modificar.")

    data = _validar(MovimientoPatch, **cambios)
    async with sesion_usuario(ctx, FINANZAS_WRITE) as (db, usuario):
        movimiento = await movimientos.editar_movimiento(db, usuario, id_movimiento, data)
        return MovimientoMCP.desde_modelo(movimiento)


async def eliminar_movimiento(
    ctx: Context,
    id_movimiento: Annotated[int, Field(ge=1)],
) -> MovimientoEliminadoMCP:
    """Elimina definitivamente un movimiento del usuario. No se puede deshacer: confirma
    con el usuario antes de llamarla."""
    async with sesion_usuario(ctx, FINANZAS_WRITE) as (db, usuario):
        await movimientos.eliminar_movimiento(db, usuario, id_movimiento)
        return MovimientoEliminadoMCP(id_movimiento=id_movimiento)


HERRAMIENTAS = (
    (listar_cuentas, "Listar cuentas", SOLO_LECTURA),
    (listar_categorias, "Listar categorías", SOLO_LECTURA),
    (buscar_movimientos, "Buscar movimientos", SOLO_LECTURA),
    (buscar_productos, "Buscar productos", SOLO_LECTURA),
    (resumen_mes, "Resumen del mes", SOLO_LECTURA),
    (tendencia_mensual, "Tendencia mensual", SOLO_LECTURA),
    (distribucion_por_categoria, "Gasto por categoría", SOLO_LECTURA),
    (distribucion_por_cuenta, "Gasto por cuenta", SOLO_LECTURA),
    (gasto_diario, "Gasto diario", SOLO_LECTURA),
    (registrar_movimiento, "Registrar movimiento", CREA),
    (editar_movimiento, "Editar movimiento", MODIFICA),
    (eliminar_movimiento, "Eliminar movimiento", MODIFICA),
    (crear_categoria, "Crear categoría", CREA),
    (crear_producto, "Agregar producto al catálogo", CREA),
    (agregar_producto_a_gasto, "Agregar producto a un gasto", CREA),
    (quitar_producto_de_gasto, "Quitar producto de un gasto", MODIFICA),
)


def registrar_herramientas_finanzas(servidor: MCPServer) -> None:
    for funcion, titulo, anotaciones in HERRAMIENTAS:
        servidor.add_tool(funcion, title=titulo, annotations=anotaciones)
