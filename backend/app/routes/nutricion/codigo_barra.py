from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.fastapi_users import current_superuser, current_user_or_api_key
from app.db import get_db
from app.routes.finanzas._http import errores_http
from app.routes.utils import obtener_usuario_actual
from app.schemas.nutricion.codigo_barra import CodigoBarraResponse
from app.services.nutricion.codigo_barra import ServicioNoDisponible, buscar_por_codigo, guardar_tabla_desde_codigo

router = APIRouter(prefix="/codigo-barra", tags=["Nutricion · Codigo de barras"])


@router.get("/{codigo}", response_model=CodigoBarraResponse, status_code=status.HTTP_200_OK)
async def buscar_codigo_barra(codigo: str, db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    """Producto y calorías por código de barras: catálogo de Ritmo y, si no está, Open Food Facts."""
    usuario = await obtener_usuario_actual(user, db)
    try:
        with errores_http():
            return await buscar_por_codigo(db, usuario, codigo)
    except ServicioNoDisponible as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=exc.mensaje) from exc


@router.post("/{codigo}/tabla", response_model=CodigoBarraResponse, status_code=status.HTTP_200_OK)
async def guardar_tabla_codigo_barra(codigo: str, db: AsyncSession = Depends(get_db), user=Depends(current_superuser)):
    """Guarda la tabla de Open Food Facts como tabla nutricional del producto con ese código
    (solo administradores; no pisa una tabla existente)."""
    usuario = await obtener_usuario_actual(user, db)
    try:
        with errores_http():
            return await guardar_tabla_desde_codigo(db, usuario, codigo)
    except ServicioNoDisponible as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=exc.mensaje) from exc
