from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.fastapi_users import current_user_or_api_key
from app.db import get_db
from app.routes.finanzas._http import errores_http, obtener_usuario_actual
from app.schemas.finanzas import (
    AplicarReglasRequest,
    AplicarReglasResponse,
    ReglaCategoriaCreate,
    ReglaCategoriaResponse,
)
from app.services.finanzas import reglas as servicio


router = APIRouter(prefix="/reglas-categoria", tags=["Finanzas · Reglas de categoría"])


@router.get("/", summary="Listar reglas de categoría", response_model=list[ReglaCategoriaResponse])
async def listar_reglas(
    user=Depends(current_user_or_api_key),
    db: AsyncSession = Depends(get_db),
):
    usuario = await obtener_usuario_actual(user, db)
    return await servicio.listar_reglas(db, usuario)


@router.post(
    "/",
    summary="Guardar reglas de categoría",
    description=(
        "Crea una o varias reglas. Si el patrón ya existe (sin distinguir mayúsculas), le "
        "cambia la categoría. Se aplican al registrar un gasto sin categoría o como «Otros» "
        "y a las filas de cartola sin categoría."
    ),
    response_model=list[ReglaCategoriaResponse],
    status_code=status.HTTP_201_CREATED,
)
async def guardar_reglas(
    data: list[ReglaCategoriaCreate],
    user=Depends(current_user_or_api_key),
    db: AsyncSession = Depends(get_db),
):
    usuario = await obtener_usuario_actual(user, db)
    with errores_http():
        return await servicio.guardar_reglas(db, usuario, data)


@router.delete(
    "/{id_regla}",
    summary="Eliminar regla de categoría",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def eliminar_regla(
    id_regla: int,
    user=Depends(current_user_or_api_key),
    db: AsyncSession = Depends(get_db),
):
    usuario = await obtener_usuario_actual(user, db)
    with errores_http():
        await servicio.eliminar_regla(db, usuario, id_regla)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/aplicar",
    summary="Aplicar las reglas a movimientos anteriores",
    description=(
        "Con confirmar=false muestra qué movimientos cambiarían de categoría, agrupados; con "
        "confirmar=true los cambia. Omite transferencias y abonos a deudas."
    ),
    response_model=AplicarReglasResponse,
)
async def aplicar_reglas(
    data: AplicarReglasRequest,
    user=Depends(current_user_or_api_key),
    db: AsyncSession = Depends(get_db),
):
    usuario = await obtener_usuario_actual(user, db)
    return await servicio.aplicar_reglas(db, usuario, data)
