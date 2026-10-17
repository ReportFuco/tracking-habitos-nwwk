"""Herramientas MCP de saldo de cuentas y transferencias entre cuentas propias.

Sirven para cuadrar una cuenta con su cartola: fijar el saldo inicial, consultar el saldo
a una fecha y registrar los traspasos que no son gasto ni ingreso.
"""
from datetime import date
from typing import Annotated
from uuid import UUID

from mcp.server.mcpserver import Context
from mcp.server.mcpserver.exceptions import ToolError
from pydantic import Field

from app.auth.scopes import FINANZAS_WRITE
from app.mcp.schemas import CuentaMCP, MovimientoMCP, SaldoCuentaMCP, TransferenciaMCP
from app.mcp.tools.finanzas import (
    CREA,
    MODIFICA,
    SOLO_LECTURA,
    Fecha,
    _fecha_chile,
    _hora_conocida,
    _validar,
    sesion_usuario,
)
from app.schemas.finanzas import CuentaUsuarioPatch
from app.services.finanzas import cuentas, transferencias


async def editar_cuenta(
    ctx: Context,
    id_cuenta: Annotated[int, Field(ge=1, description="Ver listar_cuentas.")],
    saldo_inicial: Annotated[
        int | None,
        Field(description="Saldo en CLP al cierre de fecha_saldo_inicial, tal como lo informa el banco. Puede ser negativo."),
    ] = None,
    fecha_saldo_inicial: Annotated[
        date | None,
        Field(
            description=(
                "Día del saldo inicial. Los movimientos de ese día o anteriores siguen en los "
                "reportes pero no cuentan en el saldo."
            ),
        ),
    ] = None,
    nombre_cuenta: Annotated[str | None, Field(min_length=1, max_length=100)] = None,
) -> CuentaMCP:
    """Modifica una cuenta: su nombre o su saldo inicial. Solo cambia los campos que se envían.

    Para cuadrar con el banco, usa como saldo inicial el saldo de la cartola justo antes de
    su primer movimiento (el saldo de la primera fila menos o más su monto) y como fecha el
    día anterior a esa fila. No registres un ingreso "saldo inicial": inflaría los reportes.
    """
    cambios = {
        campo: valor
        for campo, valor in {
            "saldo_inicial": saldo_inicial,
            "fecha_saldo_inicial": fecha_saldo_inicial,
            "nombre_cuenta": nombre_cuenta.strip() if nombre_cuenta else None,
        }.items()
        if valor is not None
    }
    if not cambios:
        raise ToolError("Indica al menos un campo a modificar.")
    data = _validar(CuentaUsuarioPatch, **cambios)
    async with sesion_usuario(ctx, FINANZAS_WRITE) as (db, usuario):
        await cuentas.editar_cuenta(db, usuario, id_cuenta, data)
        cuenta = await cuentas.obtener_cuenta(db, usuario, id_cuenta)
        saldo = (await cuentas.saldos(db, [cuenta]))[id_cuenta]
        return CuentaMCP.desde_modelo(cuenta, saldo.saldo)


async def saldo_cuenta(
    ctx: Context,
    id_cuenta: Annotated[int, Field(ge=1, description="Ver listar_cuentas.")],
    al: Annotated[
        date | None,
        Field(description="Saldo al cierre de este día. Si se omite, con todos los movimientos."),
    ] = None,
) -> SaldoCuentaMCP:
    """Saldo de una cuenta al cierre de un día, comparable con la columna Saldo de la cartola.

    Cuenta los movimientos por su fecha contable (la que trae la cartola) o, si aún no se
    concilian, por su fecha. Las transferencias entre cuentas propias sí mueven el saldo.
    Si no cuadra con el banco, revisa los pendientes con buscar_movimientos(estado='pendiente').
    """
    async with sesion_usuario(ctx) as (db, usuario):
        cuenta = await cuentas.obtener_cuenta(db, usuario, id_cuenta)
        saldo = (await cuentas.saldos(db, [cuenta], al=al))[id_cuenta]
        return SaldoCuentaMCP(
            id_cuenta=id_cuenta,
            cuenta=cuenta.nombre_cuenta,
            al=al,
            saldo=saldo.saldo,
            saldo_inicial=cuenta.saldo_inicial,
            fecha_saldo_inicial=cuenta.fecha_saldo_inicial,
            ingresos=saldo.ingresos,
            gastos=saldo.gastos,
            cantidad_movimientos=saldo.cantidad_movimientos,
            pendientes=saldo.pendientes,
        )


async def registrar_transferencia(
    ctx: Context,
    id_cuenta_origen: Annotated[int, Field(ge=1, description="Cuenta de donde sale la plata.")],
    id_cuenta_destino: Annotated[
        int,
        Field(ge=1, description="Cuenta a la que llega. Pagar una tarjeta de crédito es transferirle a ella."),
    ],
    monto: Annotated[int, Field(gt=0, description="CLP, entero y positivo.")],
    fecha: Fecha = None,
    descripcion: Annotated[str | None, Field(max_length=250, description="Ej. 'Pago tarjeta CMR'.")] = None,
    client_request_id: Annotated[
        UUID | None,
        Field(description="UUID generado por ti. Si repites la llamada con el mismo valor no se duplica."),
    ] = None,
) -> TransferenciaMCP:
    """Registra una transferencia entre dos cuentas propias: un gasto en el origen y un
    ingreso en el destino, unidos. Mueve el saldo de ambas, pero no cuenta como gasto ni
    ingreso en resumen_mes, tendencia_mensual, gasto_diario ni las distribuciones.
    """
    async with sesion_usuario(ctx, FINANZAS_WRITE) as (db, usuario):
        origen, destino = await transferencias.crear_transferencia(
            db,
            usuario,
            id_cuenta_origen=id_cuenta_origen,
            id_cuenta_destino=id_cuenta_destino,
            monto=monto,
            fecha=_fecha_chile(fecha),
            hora_conocida=_hora_conocida(fecha) is not False,
            descripcion=" ".join((descripcion or "").split()) or None,
            client_request_id=client_request_id,
        )
        return TransferenciaMCP(
            id_transferencia=str(origen.id_transferencia),
            origen=MovimientoMCP.desde_modelo(origen),
            destino=MovimientoMCP.desde_modelo(destino),
        )


HERRAMIENTAS = (
    (editar_cuenta, "Editar cuenta", MODIFICA),
    (saldo_cuenta, "Saldo de una cuenta", SOLO_LECTURA),
    (registrar_transferencia, "Registrar transferencia entre cuentas", CREA),
)
