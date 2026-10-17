from dataclasses import dataclass
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import Date, case, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import CuentaUsuario, Movimiento, ProductoFinanciero, Usuario
from app.models.finanzas import EnumTipoMovimiento
from app.schemas.finanzas import CuentaUsuarioCreate, CuentaUsuarioPatch
from app.services.errores import Conflicto, NoEncontrado


CHILE_TZ = ZoneInfo("America/Santiago")

# El saldo sigue al banco: un movimiento cuenta el día en que el banco lo registró. Si aún
# no calza con la cartola, se usa el día de la operación.
FECHA_SALDO = func.coalesce(Movimiento.fecha_contable, cast(Movimiento.created_at, Date))


@dataclass
class Saldo:
    saldo: int
    ingresos: int = 0
    gastos: int = 0
    cantidad_movimientos: int = 0
    pendientes: int = 0


async def saldos(db: AsyncSession, cuentas: list[CuentaUsuario], al: date | None = None) -> dict[int, Saldo]:
    """Saldo de cada cuenta al cierre del día ``al`` (sin ``al``: con todos los movimientos).

    Es ``saldo_inicial`` más ingresos menos gastos con fecha de saldo posterior a
    ``fecha_saldo_inicial``. Las transferencias cuentan: mueven plata de verdad. En una
    tarjeta de crédito las compras dejan el saldo negativo (lo que se debe).
    """
    if not cuentas:
        return {}
    es_ingreso = Movimiento.tipo_movimiento == EnumTipoMovimiento.INGRESO
    consulta = (
        select(
            Movimiento.id_cuenta,
            func.coalesce(func.sum(case((es_ingreso, Movimiento.monto), else_=0)), 0),
            func.coalesce(func.sum(case((es_ingreso, 0), else_=Movimiento.monto)), 0),
            func.count(Movimiento.id_transaccion),
            func.count(Movimiento.id_transaccion).filter(Movimiento.fecha_contable.is_(None)),
        )
        .join(CuentaUsuario, CuentaUsuario.id_cuenta == Movimiento.id_cuenta)
        .where(
            Movimiento.id_cuenta.in_([cuenta.id_cuenta for cuenta in cuentas]),
            or_(CuentaUsuario.fecha_saldo_inicial.is_(None), FECHA_SALDO > CuentaUsuario.fecha_saldo_inicial),
        )
        .group_by(Movimiento.id_cuenta)
    )
    if al is not None:
        consulta = consulta.where(FECHA_SALDO <= al)
    totales = {fila[0]: fila[1:] for fila in (await db.execute(consulta)).all()}

    resultado = {}
    for cuenta in cuentas:
        ingresos, gastos, cantidad, pendientes = totales.get(cuenta.id_cuenta, (0, 0, 0, 0))
        resultado[cuenta.id_cuenta] = Saldo(
            saldo=(cuenta.saldo_inicial or 0) + int(ingresos) - int(gastos),
            ingresos=int(ingresos),
            gastos=int(gastos),
            cantidad_movimientos=cantidad,
            pendientes=pendientes,
        )
    return resultado


async def saldos_actuales(db: AsyncSession, cuentas: list[CuentaUsuario]) -> dict[int, int | None]:
    """Saldo actual de cada cuenta; None si el usuario no ha declarado su saldo."""
    calculados = await saldos(db, [cuenta for cuenta in cuentas if cuenta.saldo_inicial is not None])
    return {
        cuenta.id_cuenta: calculados[cuenta.id_cuenta].saldo if cuenta.id_cuenta in calculados else None
        for cuenta in cuentas
    }


async def declarar_saldo(db: AsyncSession, usuario: Usuario, id_cuenta: int, saldo: int) -> CuentaUsuario:
    """El usuario dice cuánto tiene hoy en la cuenta y desde ahí cada movimiento lo mueve.

    Queda como saldo al cierre de ayer, descontando lo ya registrado desde hoy (y lo que
    la cartola trae con fecha contable futura): así el saldo actual es exactamente el
    monto declarado.
    """
    cuenta = await obtener_cuenta(db, usuario, id_cuenta)
    cuenta.saldo_inicial = 0
    cuenta.fecha_saldo_inicial = datetime.now(CHILE_TZ).date() - timedelta(days=1)
    await db.flush()
    desde_hoy = (await saldos(db, [cuenta]))[id_cuenta].saldo
    cuenta.saldo_inicial = saldo - desde_hoy
    await db.flush()
    return cuenta


async def obtener_cuenta(db: AsyncSession, usuario: Usuario, id_cuenta: int) -> CuentaUsuario:
    """Cuenta activa del usuario, con su producto y banco."""
    cuenta = await db.scalar(
        select(CuentaUsuario)
        .where(
            CuentaUsuario.id_cuenta == id_cuenta,
            CuentaUsuario.activo.is_(True),
            CuentaUsuario.id_usuario == usuario.id_usuario,
        )
        .options(_con_producto_y_banco())
    )
    if not cuenta:
        raise NoEncontrado("Cuenta no encontrada.")
    return cuenta


def _con_producto_y_banco():
    return selectinload(CuentaUsuario.producto_financiero).selectinload(ProductoFinanciero.banco)


async def _recargar_con_producto(db: AsyncSession, id_cuenta: int) -> CuentaUsuario:
    return await db.scalar(
        select(CuentaUsuario)
        .where(CuentaUsuario.id_cuenta == id_cuenta)
        .options(_con_producto_y_banco())
    )


async def listar_cuentas(
    db: AsyncSession,
    usuario: Usuario,
    *,
    solo_activas: bool = False,
) -> list[CuentaUsuario]:
    consulta = (
        select(CuentaUsuario)
        .where(CuentaUsuario.id_usuario == usuario.id_usuario)
        .options(_con_producto_y_banco())
    )
    if solo_activas:
        consulta = consulta.where(CuentaUsuario.activo.is_(True))
    return (await db.execute(consulta)).scalars().all()


async def obtener_cuenta_con_movimientos(
    db: AsyncSession,
    usuario: Usuario,
    id_cuenta: int,
) -> CuentaUsuario:
    cuenta = (
        await db.execute(
            select(CuentaUsuario)
            .where(
                CuentaUsuario.id_cuenta == id_cuenta,
                CuentaUsuario.activo.is_(True),
                CuentaUsuario.id_usuario == usuario.id_usuario
            )
            .options(
                _con_producto_y_banco(),
                selectinload(CuentaUsuario.transacciones).selectinload(Movimiento.categoria),
                selectinload(CuentaUsuario.transacciones).selectinload(Movimiento.cuenta),
            )
        )
    ).scalar_one_or_none()

    if not cuenta:
        raise NoEncontrado("Cuenta no encontrada.")
    return cuenta


async def _validar_producto_activo(db: AsyncSession, id_producto_financiero: int) -> None:
    producto_financiero = await db.scalar(
        select(ProductoFinanciero).where(
            ProductoFinanciero.id_producto_financiero == id_producto_financiero,
            ProductoFinanciero.activo.is_(True),
        )
    )
    if not producto_financiero:
        raise NoEncontrado("Producto financiero no encontrado o inactivo.")


async def crear_cuenta(db: AsyncSession, usuario: Usuario, data: CuentaUsuarioCreate) -> CuentaUsuario:
    await _validar_producto_activo(db, data.id_producto_financiero)

    # Validar que el usuario no tenga una cuenta con el mismo nombre
    cuenta_existente = (
        await db.execute(
            select(CuentaUsuario).where(
                CuentaUsuario.id_usuario == usuario.id_usuario,
                CuentaUsuario.nombre_cuenta == data.nombre_cuenta
            )
        )
    ).scalar_one_or_none()

    if cuenta_existente:
        raise Conflicto("Ya existe una cuenta con ese nombre.")

    nueva_cuenta = CuentaUsuario(
        id_usuario=usuario.id_usuario,
        id_producto_financiero=data.id_producto_financiero,
        nombre_cuenta=data.nombre_cuenta,
    )

    db.add(nueva_cuenta)

    # flush para obtener el id generado
    await db.flush()
    if data.saldo_actual is not None:
        await declarar_saldo(db, usuario, nueva_cuenta.id_cuenta, data.saldo_actual)
    return await _recargar_con_producto(db, nueva_cuenta.id_cuenta)


async def editar_cuenta(
    db: AsyncSession,
    usuario: Usuario,
    id_cuenta: int,
    data: CuentaUsuarioPatch,
) -> CuentaUsuario:
    cuenta = await db.scalar(
        select(CuentaUsuario)
        .where(
            CuentaUsuario.id_cuenta == id_cuenta,
            CuentaUsuario.activo.is_(True),
            CuentaUsuario.id_usuario == usuario.id_usuario
        )
    )
    if not cuenta:
        raise NoEncontrado("Cuenta no encontrada.")

    if data.id_producto_financiero is not None:
        await _validar_producto_activo(db, data.id_producto_financiero)

    if data.nombre_cuenta:
        existe = await db.scalar(
            select(CuentaUsuario.id_cuenta)
            .where(
                CuentaUsuario.id_usuario == usuario.id_usuario,
                CuentaUsuario.nombre_cuenta == data.nombre_cuenta,
                CuentaUsuario.id_cuenta != id_cuenta
            )
        )
        if existe:
            raise Conflicto("El nombre de la cuenta ya existe.")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(cuenta, field, value)

    await db.flush()
    return await _recargar_con_producto(db, id_cuenta)


async def desactivar_cuenta(db: AsyncSession, usuario: Usuario, id_cuenta: int) -> None:
    cuenta = (
        await db.execute(
            select(CuentaUsuario)
            .where(
                CuentaUsuario.id_cuenta == id_cuenta,
                CuentaUsuario.id_usuario == usuario.id_usuario,
                CuentaUsuario.activo.is_(True)
            )
        )
    ).scalar_one_or_none()

    if not cuenta:
        raise NoEncontrado("Cuenta no encontrada o ya se encuentra desactivada.")

    cuenta.activo = False
