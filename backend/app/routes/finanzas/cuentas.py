from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from app.schemas.finanzas import (
    CuentaSaldoDeclarar,
    CuentaUsuarioCreate,
    CuentaUsuarioResponse,
    CuentaUsuarioPatch,
    CuentaUsuarioMovimientosResponse
)
from app.auth.fastapi_users import current_user_or_api_key
from app.routes.finanzas._http import errores_http, obtener_usuario_actual
from app.services.finanzas import cuentas as servicio


router = APIRouter(prefix="/cuentas", tags=["Finanzas · Cuentas"])


async def _con_saldo(db: AsyncSession, cuentas: list) -> list[CuentaUsuarioResponse]:
    saldos = await servicio.saldos_actuales(db, cuentas)
    return [
        CuentaUsuarioResponse.model_validate(cuenta).model_copy(update={"saldo_actual": saldos[cuenta.id_cuenta]})
        for cuenta in cuentas
    ]


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

    cuentas = await servicio.listar_cuentas(db, usuario)

    if not cuentas:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cuentas no Encontradas"
        )

    return await _con_saldo(db, cuentas)


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
    with errores_http():
        return await servicio.obtener_cuenta_con_movimientos(db, usuario, id_cuenta)


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
    with errores_http():
        cuenta = await servicio.crear_cuenta(db, usuario, data)
    [respuesta] = await _con_saldo(db, [cuenta])
    return respuesta


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
    with errores_http():
        cuenta = await servicio.editar_cuenta(db, usuario, id_cuenta, data)
    [respuesta] = await _con_saldo(db, [cuenta])
    return respuesta


@router.post(
    path="/{id_cuenta}/saldo",
    summary="Declarar saldo de hoy",
    description=(
        "Fija cuánto hay hoy en la cuenta. Desde ahí cada gasto lo baja y cada ingreso lo "
        "sube. Sirve para partir y para volver a cuadrar con el banco."
    ),
    status_code=status.HTTP_200_OK,
    response_model=CuentaUsuarioResponse,
)
async def declarar_saldo(
    id_cuenta: int,
    data: CuentaSaldoDeclarar,
    db: AsyncSession = Depends(get_db),
    user = Depends(current_user_or_api_key),
):
    usuario = await obtener_usuario_actual(user, db)
    with errores_http():
        await servicio.declarar_saldo(db, usuario, id_cuenta, data.saldo)
        cuenta = await servicio.obtener_cuenta(db, usuario, id_cuenta)
    [respuesta] = await _con_saldo(db, [cuenta])
    return respuesta


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
    with errores_http():
        await servicio.desactivar_cuenta(db, usuario, id_cuenta)
