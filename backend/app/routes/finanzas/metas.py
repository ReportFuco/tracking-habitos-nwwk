from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.fastapi_users import current_user_or_api_key
from app.db import get_db
from app.routes.finanzas._http import errores_http, obtener_usuario_actual
from app.schemas.finanzas import MetasGastoResponse, MetasGastoUpdate
from app.services.finanzas import semanal as servicio


router = APIRouter(prefix="/metas-gasto", tags=["Finanzas · Metas de gasto"])


@router.get(
    "/",
    summary="Metas de gasto",
    description=(
        "Meta semanal y, por categoría, si cuenta en el gasto semanal y su presupuesto. Trae "
        "el promedio de las últimas 4 semanas para sugerir montos."
    ),
    response_model=MetasGastoResponse,
)
async def obtener_metas(
    user=Depends(current_user_or_api_key),
    db: AsyncSession = Depends(get_db),
):
    usuario = await obtener_usuario_actual(user, db)
    return await servicio.obtener_metas(db, usuario)


@router.patch(
    "/",
    summary="Actualizar metas de gasto",
    description=(
        "Solo cambia lo enviado: `meta_semanal: null` quita la meta y omitirla no la toca. "
        "Cada categoría de la lista se actualiza; las demás quedan como estaban."
    ),
    response_model=MetasGastoResponse,
)
async def actualizar_metas(
    data: MetasGastoUpdate,
    user=Depends(current_user_or_api_key),
    db: AsyncSession = Depends(get_db),
):
    usuario = await obtener_usuario_actual(user, db)
    with errores_http():
        return await servicio.actualizar_metas(db, usuario, data)
