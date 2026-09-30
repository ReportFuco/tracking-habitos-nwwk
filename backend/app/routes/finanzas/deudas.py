from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.fastapi_users import current_user_or_api_key
from app.db import get_db
from app.models.finanzas import EnumTipoDeuda
from app.routes.finanzas._http import errores_http, obtener_usuario_actual
from app.schemas.finanzas import DeudaCreate, DeudaListResponse, DeudaPatch, DeudaResponse
from app.services.finanzas import deudas as servicio


router = APIRouter(prefix="/deudas", tags=["Finanzas · Deudas"])


@router.get(
    "/",
    summary="Listar deudas",
    description=(
        "Deudas del usuario con su saldo: las activas primero. Los totales suman el saldo de "
        "todas las activas, sin importar los filtros. Los abonos se consultan con "
        "GET /api/finanzas/movimientos/?id_deuda=."
    ),
    response_model=DeudaListResponse,
)
async def listar_deudas(
    user=Depends(current_user_or_api_key),
    db: AsyncSession = Depends(get_db),
    estado: Annotated[Literal["activa", "pagada"] | None, Query()] = None,
    tipo: Annotated[EnumTipoDeuda | None, Query()] = None,
):
    usuario = await obtener_usuario_actual(user, db)
    return await servicio.listar_deudas(db, usuario, estado=estado, tipo=tipo)


@router.get("/{id_deuda}", summary="Obtener deuda", response_model=DeudaResponse)
async def obtener_deuda(
    id_deuda: int,
    user=Depends(current_user_or_api_key),
    db: AsyncSession = Depends(get_db),
):
    usuario = await obtener_usuario_actual(user, db)
    with errores_http():
        return await servicio.obtener_deuda(db, usuario, id_deuda)


@router.post(
    "/",
    summary="Crear deuda",
    description=(
        "Registra una deuda. No crea movimientos: los abonos se registran como movimientos con "
        "id_deuda (gastos para 'debo', ingresos para 'me_deben')."
    ),
    status_code=status.HTTP_201_CREATED,
    response_model=DeudaResponse,
)
async def crear_deuda(
    data: DeudaCreate,
    user=Depends(current_user_or_api_key),
    db: AsyncSession = Depends(get_db),
):
    usuario = await obtener_usuario_actual(user, db)
    with errores_http():
        return await servicio.crear_deuda(db, usuario, data)


@router.patch("/{id_deuda}", summary="Modificar deuda", response_model=DeudaResponse)
async def editar_deuda(
    id_deuda: int,
    data: DeudaPatch,
    user=Depends(current_user_or_api_key),
    db: AsyncSession = Depends(get_db),
):
    usuario = await obtener_usuario_actual(user, db)
    with errores_http():
        return await servicio.editar_deuda(db, usuario, id_deuda, data)


@router.delete(
    "/{id_deuda}",
    summary="Eliminar deuda",
    description="Sus abonos no se borran: quedan como movimientos sin deuda.",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def eliminar_deuda(
    id_deuda: int,
    user=Depends(current_user_or_api_key),
    db: AsyncSession = Depends(get_db),
):
    usuario = await obtener_usuario_actual(user, db)
    with errores_http():
        await servicio.eliminar_deuda(db, usuario, id_deuda)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
