"""Herramientas MCP de deudas: lo que el usuario debe y lo que le deben.

Los abonos no tienen herramienta propia: son movimientos con id_deuda (registrar_movimiento
o editar_movimiento), así cuentan en el gasto/ingreso del mes como cualquier otro.
"""
from typing import Annotated, Literal

from mcp.server.mcpserver import Context
from mcp.server.mcpserver.exceptions import ToolError
from pydantic import Field

from app.auth.scopes import FINANZAS_WRITE
from app.mcp.schemas import DeudaEliminadaMCP
from app.mcp.tools.finanzas import CREA, MODIFICA, SOLO_LECTURA, _validar, sesion_usuario
from app.models.finanzas import EnumTipoDeuda
from app.schemas.finanzas import DeudaCreate, DeudaListResponse, DeudaPatch, DeudaResponse
from app.services.finanzas import deudas


TipoDeuda = Literal["debo", "me_deben"]


async def listar_deudas(
    ctx: Context,
    estado: Annotated[
        Literal["activa", "pagada"] | None,
        Field(description="Sin estado devuelve todas: activas primero."),
    ] = None,
    tipo: Annotated[TipoDeuda | None, Field(description="'debo' o 'me_deben'.")] = None,
) -> DeudaListResponse:
    """Deudas del usuario con monto total, abonado, saldo y estado. total_debo y
    total_me_deben suman el saldo pendiente de todas las activas.

    Para ver los abonos de una deuda usa buscar_movimientos con id_deuda.
    """
    async with sesion_usuario(ctx) as (db, usuario):
        return await deudas.listar_deudas(
            db, usuario, estado=estado, tipo=EnumTipoDeuda(tipo) if tipo else None
        )


async def crear_deuda(
    ctx: Context,
    tipo: Annotated[
        TipoDeuda,
        Field(description="'debo' (préstamo, crédito, compra en cuotas) o 'me_deben' (plata prestada)."),
    ],
    nombre: Annotated[str, Field(min_length=1, max_length=120, description="Ej. 'Crédito de consumo'.")],
    monto_total: Annotated[int, Field(gt=0, description="Monto total en CLP.")],
    contraparte: Annotated[
        str | None,
        Field(max_length=120, description="A quién se le debe o quién debe, ej. 'Banco Estado', 'Juan'."),
    ] = None,
    descripcion: Annotated[str | None, Field(max_length=500)] = None,
) -> DeudaResponse:
    """Registra una deuda. No crea movimientos: los pagos se registran después con
    registrar_movimiento e id_deuda (gastos para 'debo', ingresos para 'me_deben').

    Si el usuario ya pagó una parte antes de registrarla, usa como monto_total lo que queda
    por pagar, o registra esos pagos como movimientos con id_deuda si quiere el historial.
    """
    data = _validar(
        DeudaCreate,
        tipo=tipo,
        nombre=nombre,
        monto_total=monto_total,
        contraparte=contraparte,
        descripcion=descripcion,
    )
    async with sesion_usuario(ctx, FINANZAS_WRITE) as (db, usuario):
        return await deudas.crear_deuda(db, usuario, data)


async def editar_deuda(
    ctx: Context,
    id_deuda: Annotated[int, Field(ge=1)],
    nombre: Annotated[str | None, Field(min_length=1, max_length=120)] = None,
    monto_total: Annotated[
        int | None,
        Field(gt=0, description="Nuevo total en CLP (ej. si sumó intereses). No puede ser menor a lo abonado."),
    ] = None,
    contraparte: Annotated[str | None, Field(max_length=120, description="Un texto vacío la borra.")] = None,
    descripcion: Annotated[str | None, Field(max_length=500, description="Un texto vacío la borra.")] = None,
) -> DeudaResponse:
    """Modifica una deuda. Solo cambia los campos que se envían; el tipo no se puede cambiar."""
    cambios = {
        campo: valor
        for campo, valor in {"nombre": nombre, "monto_total": monto_total}.items()
        if valor is not None
    }
    for campo, valor in {"contraparte": contraparte, "descripcion": descripcion}.items():
        if valor is not None:
            cambios[campo] = valor.strip() or None
    if not cambios:
        raise ToolError("Indica al menos un campo a modificar.")

    data = _validar(DeudaPatch, **cambios)
    async with sesion_usuario(ctx, FINANZAS_WRITE) as (db, usuario):
        return await deudas.editar_deuda(db, usuario, id_deuda, data)


async def eliminar_deuda(ctx: Context, id_deuda: Annotated[int, Field(ge=1)]) -> DeudaEliminadaMCP:
    """Elimina una deuda. Sus abonos no se borran: quedan como movimientos normales sin
    deuda. No se puede deshacer: confirma con el usuario antes de llamarla."""
    async with sesion_usuario(ctx, FINANZAS_WRITE) as (db, usuario):
        await deudas.eliminar_deuda(db, usuario, id_deuda)
        return DeudaEliminadaMCP(id_deuda=id_deuda)


HERRAMIENTAS = (
    (listar_deudas, "Listar deudas", SOLO_LECTURA),
    (crear_deuda, "Registrar deuda", CREA),
    (editar_deuda, "Editar deuda", MODIFICA),
    (eliminar_deuda, "Eliminar deuda", MODIFICA),
)
