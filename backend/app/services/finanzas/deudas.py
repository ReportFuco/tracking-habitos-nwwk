"""Deudas: lo que el usuario debe (``debo``) y lo que le deben (``me_deben``).

Una deuda se abona con movimientos que la referencian (``Movimiento.id_deuda``): gastos
para ``debo`` e ingresos para ``me_deben``. El saldo se calcula, no se guarda, así que
editar o borrar un abono lo corrige solo. Nunca se permite abonar más que el saldo.
"""
from datetime import datetime
from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Deuda, Movimiento, Usuario
from app.models.finanzas import EnumTipoDeuda, EnumTipoMovimiento
from app.schemas.finanzas import DeudaCreate, DeudaListResponse, DeudaPatch, DeudaResponse
from app.services.errores import Conflicto, NoEncontrado


EstadoDeuda = Literal["activa", "pagada"]

TIPO_ABONO = {
    EnumTipoDeuda.DEBO: EnumTipoMovimiento.GASTO,
    EnumTipoDeuda.ME_DEBEN: EnumTipoMovimiento.INGRESO,
}


def _clp(monto: int) -> str:
    return "$" + f"{monto:,}".replace(",", ".")


def _consulta_con_abonos():
    return (
        select(
            Deuda,
            func.coalesce(func.sum(Movimiento.monto), 0),
            func.count(Movimiento.id_transaccion),
            func.max(Movimiento.created_at),
        )
        .outerjoin(Movimiento, Movimiento.id_deuda == Deuda.id_deuda)
        .group_by(Deuda.id_deuda)
    )


def _respuesta(deuda: Deuda, abonado: int, cantidad: int, ultimo: datetime | None) -> DeudaResponse:
    saldo = deuda.monto_total - int(abonado)
    return DeudaResponse(
        id_deuda=deuda.id_deuda,
        tipo=deuda.tipo,
        nombre=deuda.nombre,
        contraparte=deuda.contraparte,
        descripcion=deuda.descripcion,
        monto_total=deuda.monto_total,
        abonado=int(abonado),
        saldo=saldo,
        estado="pagada" if saldo <= 0 else "activa",
        cantidad_abonos=cantidad,
        ultimo_abono=ultimo,
        created_at=deuda.created_at,
    )


async def listar_deudas(
    db: AsyncSession,
    usuario: Usuario,
    *,
    estado: EstadoDeuda | None = None,
    tipo: EnumTipoDeuda | None = None,
) -> DeudaListResponse:
    """Activas primero y luego pagadas; dentro de cada grupo, las más recientes primero.
    Los totales son de todas las deudas activas, sin importar los filtros."""
    filas = (
        await db.execute(
            _consulta_con_abonos()
            .where(Deuda.id_usuario == usuario.id_usuario)
            .order_by(Deuda.created_at.desc(), Deuda.id_deuda.desc())
        )
    ).all()
    deudas = [_respuesta(*fila) for fila in filas]
    deudas.sort(key=lambda deuda: deuda.estado == "pagada")

    total_debo = sum(d.saldo for d in deudas if d.tipo == EnumTipoDeuda.DEBO and d.estado == "activa")
    total_me_deben = sum(d.saldo for d in deudas if d.tipo == EnumTipoDeuda.ME_DEBEN and d.estado == "activa")
    if estado is not None:
        deudas = [d for d in deudas if d.estado == estado]
    if tipo is not None:
        deudas = [d for d in deudas if d.tipo == tipo]
    return DeudaListResponse(items=deudas, total_debo=total_debo, total_me_deben=total_me_deben)


async def _obtener(db: AsyncSession, usuario: Usuario, id_deuda: int, *, bloquear: bool = False) -> Deuda:
    consulta = select(Deuda).where(Deuda.id_deuda == id_deuda, Deuda.id_usuario == usuario.id_usuario)
    if bloquear:
        # Serializa abonos concurrentes a la misma deuda: sin esto dos abonos simultáneos
        # podrían superar juntos el saldo.
        consulta = consulta.with_for_update()
    deuda = await db.scalar(consulta)
    if not deuda:
        raise NoEncontrado("Deuda no encontrada.")
    return deuda


async def obtener_deuda(db: AsyncSession, usuario: Usuario, id_deuda: int) -> DeudaResponse:
    fila = (
        await db.execute(
            _consulta_con_abonos().where(Deuda.id_deuda == id_deuda, Deuda.id_usuario == usuario.id_usuario)
        )
    ).first()
    if not fila:
        raise NoEncontrado("Deuda no encontrada.")
    return _respuesta(*fila)


async def _abonado(db: AsyncSession, id_deuda: int, *, excluir_movimiento: int | None = None) -> int:
    consulta = select(func.coalesce(func.sum(Movimiento.monto), 0)).where(Movimiento.id_deuda == id_deuda)
    if excluir_movimiento is not None:
        consulta = consulta.where(Movimiento.id_transaccion != excluir_movimiento)
    return int(await db.scalar(consulta))


async def validar_abono(
    db: AsyncSession,
    usuario: Usuario,
    id_deuda: int,
    *,
    tipo_movimiento: EnumTipoMovimiento,
    monto: int,
    excluir_movimiento: int | None = None,
    ya_comprometido: int = 0,
) -> Deuda:
    """El movimiento puede abonar la deuda: es del usuario, el tipo calza y no supera el
    saldo. ``excluir_movimiento`` descuenta el abono que se está editando y
    ``ya_comprometido`` suma abonos aún no guardados (importación en lote)."""
    deuda = await _obtener(db, usuario, id_deuda, bloquear=True)
    esperado = TIPO_ABONO[deuda.tipo]
    if tipo_movimiento != esperado:
        if deuda.tipo == EnumTipoDeuda.DEBO:
            raise Conflicto(f"«{deuda.nombre}» es una deuda que tienes: se abona con gastos, no con ingresos.")
        raise Conflicto(f"«{deuda.nombre}» es plata que te deben: se abona con ingresos, no con gastos.")

    saldo = deuda.monto_total - await _abonado(db, id_deuda, excluir_movimiento=excluir_movimiento) - ya_comprometido
    if saldo <= 0:
        raise Conflicto(f"«{deuda.nombre}» ya está pagada.")
    if monto > saldo:
        raise Conflicto(
            f"El abono de {_clp(monto)} supera el saldo pendiente de «{deuda.nombre}» ({_clp(saldo)}). "
            "Si la deuda creció (intereses, reajustes), aumenta primero su monto total."
        )
    return deuda


async def crear_deuda(db: AsyncSession, usuario: Usuario, data: DeudaCreate) -> DeudaResponse:
    deuda = Deuda(id_usuario=usuario.id_usuario, **data.model_dump())
    db.add(deuda)
    await db.flush()
    return await obtener_deuda(db, usuario, deuda.id_deuda)


async def editar_deuda(db: AsyncSession, usuario: Usuario, id_deuda: int, data: DeudaPatch) -> DeudaResponse:
    deuda = await _obtener(db, usuario, id_deuda, bloquear=True)
    cambios = data.model_dump(exclude_unset=True)

    if "monto_total" in cambios:
        abonado = await _abonado(db, id_deuda)
        if cambios["monto_total"] < abonado:
            raise Conflicto(
                f"El monto total no puede ser menor a lo ya abonado ({_clp(abonado)}). "
                "Quita primero los abonos que sobran."
            )

    for campo, valor in cambios.items():
        setattr(deuda, campo, valor)
    await db.flush()
    return await obtener_deuda(db, usuario, id_deuda)


async def eliminar_deuda(db: AsyncSession, usuario: Usuario, id_deuda: int) -> None:
    """Borra la deuda. Sus abonos quedan como movimientos normales (la FK los desvincula)."""
    deuda = await _obtener(db, usuario, id_deuda)
    await db.delete(deuda)
    await db.flush()
