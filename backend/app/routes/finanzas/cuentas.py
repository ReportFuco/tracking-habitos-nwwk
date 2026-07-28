from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from sqlalchemy import select
from app.models import CuentaUsuario, Movimiento, ProductoFinanciero, Usuario
from app.schemas.finanzas import (
    CuentaUsuarioCreate,
    CuentaUsuarioResponse,
    CuentaUsuarioPatch,
    CuentaUsuarioMovimientosResponse
)
from sqlalchemy.orm import selectinload
from app.auth.fastapi_users import current_user_or_api_key


router = APIRouter(prefix="/cuentas", tags=["Finanzas · Cuentas"])


async def obtener_usuario_actual(user, db: AsyncSession) -> Usuario:
    usuario = await db.scalar(
        select(Usuario).where(Usuario.auth_user_id == user.id)
    )
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Perfil de usuario no encontrado."
        )
    return usuario

@router.get(
    path="/",
    response_model=list[CuentaUsuarioResponse],
    summary="Obtener Cuentas del Usuario",
    description="Muestra todas las cuentas del usuario por su ID",
    status_code=status.HTTP_200_OK
)
async def obtener_cuentas_usuario(
    user = Depends(current_user_or_api_key),
    db:AsyncSession = Depends(get_db)
):    
    usuario = await obtener_usuario_actual(user, db)

    cuentas = (
        await db.execute(
            select(CuentaUsuario)
            .where(CuentaUsuario.id_usuario == usuario.id_usuario)
            .options(
                selectinload(CuentaUsuario.producto_financiero)
                .selectinload(ProductoFinanciero.banco)
            )
        )
    ).scalars().all()

    if not cuentas:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cuentas no Encontradas"
        )
    
    return cuentas


@router.get(
    path="/{id_cuenta}",
    summary="Obtener cuenta y movimientos",
    description="Obtiene una cuenta de un usuario y sus movimientos",
    status_code=status.HTTP_200_OK,
    response_model=CuentaUsuarioMovimientosResponse
)
async def obtener_movimientos_cuenta(
    id_cuenta:int,
    user = Depends(current_user_or_api_key),
    db: AsyncSession = Depends(get_db)
):
    usuario = await obtener_usuario_actual(user, db)

    movimientos_cuenta = (
        await db.execute(
            select(CuentaUsuario)
            .where(
                CuentaUsuario.id_cuenta == id_cuenta,
                CuentaUsuario.activo.is_(True),
                CuentaUsuario.id_usuario == usuario.id_usuario
            )
            .options(
            selectinload(CuentaUsuario.producto_financiero)
                .selectinload(ProductoFinanciero.banco),
            selectinload(CuentaUsuario.transacciones)
                .selectinload(Movimiento.categoria),

            selectinload(CuentaUsuario.transacciones)
                .selectinload(Movimiento.cuenta)
)
        )
    ).scalar_one_or_none()

    if not movimientos_cuenta:
        raise HTTPException(
            status_code=404,
            detail="Cuenta no encontrada."
        )
    
    return movimientos_cuenta


@router.post(
    path="/",
    summary="Crear cuenta usuario",
    description="Crea una cuenta del usuario asociada a un producto financiero definido para un banco",
    status_code=status.HTTP_201_CREATED,
    response_model=CuentaUsuarioResponse
)
async def crear_cuenta_usuario(
    data: CuentaUsuarioCreate,
    db: AsyncSession = Depends(get_db),
    user = Depends(current_user_or_api_key),
):
    usuario = await obtener_usuario_actual(user, db)

    producto_financiero = (
        await db.execute(
            select(ProductoFinanciero)
            .where(
                ProductoFinanciero.id_producto_financiero == data.id_producto_financiero,
                ProductoFinanciero.activo.is_(True),
            )
            .options(selectinload(ProductoFinanciero.banco))
        )
    ).scalar_one_or_none()

    if not producto_financiero:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Producto financiero no encontrado o inactivo."
        )

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
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una cuenta con ese nombre."
        )

    # Crear cuenta
    nueva_cuenta = CuentaUsuario(
        id_usuario=usuario.id_usuario,
        id_producto_financiero=data.id_producto_financiero,
        nombre_cuenta=data.nombre_cuenta,
    )

    db.add(nueva_cuenta)

    # flush para obtener el id generado
    await db.flush()
    nueva_cuenta = await db.scalar(
        select(CuentaUsuario)
        .where(CuentaUsuario.id_cuenta == nueva_cuenta.id_cuenta)
        .options(
            selectinload(CuentaUsuario.producto_financiero)
            .selectinload(ProductoFinanciero.banco)
        )
    )

    return nueva_cuenta


@router.patch(
    path="/{id_cuenta}",
    summary="Modificar Cuenta",
    description="Modifica la cuenta del usuario",
    status_code=status.HTTP_200_OK,
    response_model=CuentaUsuarioResponse
)
async def editar_cuenta(
    id_cuenta: int,
    data: CuentaUsuarioPatch,
    db: AsyncSession = Depends(get_db),
    user = Depends(current_user_or_api_key)
):
    usuario = await obtener_usuario_actual(user, db)

    cuenta = await db.scalar(
        select(CuentaUsuario)
        .where(
            CuentaUsuario.id_cuenta == id_cuenta,
            CuentaUsuario.activo.is_(True),
            CuentaUsuario.id_usuario == usuario.id_usuario
        )
    )

    if not cuenta:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cuenta no encontrada."
        )

    if data.id_producto_financiero is not None:
        producto_financiero = await db.scalar(
            select(ProductoFinanciero).where(
                ProductoFinanciero.id_producto_financiero == data.id_producto_financiero,
                ProductoFinanciero.activo.is_(True),
            )
        )
        if not producto_financiero:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Producto financiero no encontrado o inactivo."
            )

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
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="El nombre de la cuenta ya existe."
            )

    update_data = data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(cuenta, field, value)

    await db.flush()

    cuenta = await db.scalar(
        select(CuentaUsuario)
        .where(CuentaUsuario.id_cuenta == id_cuenta)
        .options(
            selectinload(CuentaUsuario.producto_financiero)
            .selectinload(ProductoFinanciero.banco)
        )
    )

    return cuenta

@router.delete(
    path="/{id_cuenta}",
    summary="Desactivar Cuenta",
    description="Desactiva la cuenta del usuario",
    status_code=status.HTTP_204_NO_CONTENT
)
async def desactivar_cuenta(
    id_cuenta: int,
    user = Depends(current_user_or_api_key),
    db: AsyncSession = Depends(get_db)
):
    usuario = await obtener_usuario_actual(user, db)

    existe = (
        await db.execute(
            select(CuentaUsuario)
            .where(
                CuentaUsuario.id_cuenta == id_cuenta,
                CuentaUsuario.id_usuario == usuario.id_usuario,
                CuentaUsuario.activo.is_(True)
            )
        )
    ).scalar_one_or_none()

    if not existe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cuenta no encontrada o ya se encuentra desactivada."
        )

    existe.activo = False
