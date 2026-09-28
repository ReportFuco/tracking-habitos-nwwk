from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import CuentaUsuario, Movimiento, ProductoFinanciero, Usuario
from app.schemas.finanzas import CuentaUsuarioCreate, CuentaUsuarioPatch
from app.services.errores import Conflicto, NoEncontrado


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
