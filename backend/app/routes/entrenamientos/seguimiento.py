from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.fastapi_users import current_user_or_api_key
from app.db import get_db
from app.routes.finanzas._http import errores_http, obtener_usuario_actual
from app.schemas.entrenamientos.analisis import (
    CargaMuscularResponse,
    SeguimientoResponse,
    SeguimientosResponse,
)
from app.services.entrenamientos import carga, seguimiento


router = APIRouter(tags=["Entrenamientos · Seguimiento"])


@router.get("/carga-muscular", response_model=CargaMuscularResponse)
async def obtener_carga_muscular(
    modo: Literal["7d", "semana"] = Query(
        "7d", description="7d: los ultimos 7 dias hasta ahora. semana: de lunes a domingo."
    ),
    fecha: date | None = Query(
        None, description="Con modo=semana, cualquier dia de la semana a mostrar. Por defecto, la actual."
    ),
    user=Depends(current_user_or_api_key),
    db: AsyncSession = Depends(get_db),
):
    usuario = await obtener_usuario_actual(user, db)
    periodo = carga.periodo_movil() if modo == "7d" else carga.periodo_semana(fecha)
    return CargaMuscularResponse.desde_carga(
        await carga.calcular_carga(db, usuario.id_usuario, periodo)
    )


@router.get("/seguimiento", response_model=SeguimientosResponse)
async def listar_seguimientos(
    limite: int = Query(20, ge=1, le=100),
    user=Depends(current_user_or_api_key),
    db: AsyncSession = Depends(get_db),
):
    usuario = await obtener_usuario_actual(user, db)
    filas = await seguimiento.listar_seguimientos(db, usuario.id_usuario, limite=limite)
    return SeguimientosResponse(
        seguimientos=[SeguimientoResponse.model_validate(fila) for fila in filas]
    )


@router.delete("/seguimiento/{id_seguimiento}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_seguimiento(
    id_seguimiento: int,
    user=Depends(current_user_or_api_key),
    db: AsyncSession = Depends(get_db),
):
    usuario = await obtener_usuario_actual(user, db)
    with errores_http():
        await seguimiento.eliminar_seguimiento(db, usuario.id_usuario, id_seguimiento)
