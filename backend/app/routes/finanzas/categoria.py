from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from app.auth.fastapi_users import current_superuser, current_user_or_api_key
from app.routes.finanzas._http import errores_http
from app.schemas.finanzas import (
    CategoriaResponse,
    CategoriaCreate,
    CategoriaPatch
)
from app.services.finanzas import categorias as servicio


router = APIRouter(prefix="/categoria", tags=["Finanzas · Categorías"])

@router.get(
    "/",
    response_model=list[CategoriaResponse],
    summary="Obtener todas las categorías",
    description="Enpoint encargado de obtener todas las categorías de los movimientos",
    status_code=status.HTTP_200_OK
)
async def obtener_categorias(
    db:AsyncSession = Depends(get_db),
    user = Depends(current_user_or_api_key)
):
    return await servicio.listar_categorias(db)


@router.get(
    "/{id_categoria}",
    response_model=CategoriaResponse,
    summary="Obtener categoría por ID",
    description="Obtiene una categoría específica por su ID",
    status_code=status.HTTP_200_OK
)
async def obtener_categoria(
    id_categoria: int,
    db: AsyncSession = Depends(get_db),
    user = Depends(current_user_or_api_key)
):
    with errores_http():
        return await servicio.obtener_categoria(db, id_categoria)


@router.post(
    "/",
    response_model=CategoriaResponse,
    summary="Crear categoría",
    description="Crea categoria para utilizarla en los movimientos financieros",
    status_code=status.HTTP_201_CREATED
)
async def crear_categoria(
    data: CategoriaCreate,
    db: AsyncSession = Depends(get_db),
    user = Depends(current_superuser)
):
    with errores_http():
        return await servicio.crear_categoria(db, data)


@router.patch(
    "/{id_categoria}",
    response_model=CategoriaResponse,
    summary="Actualizar categoría",
    description="Actualiza el nombre de una categoría existente"
)
async def actualizar_categoria(
    id_categoria:int,
    data:CategoriaPatch,
    db:AsyncSession = Depends(get_db),
    user = Depends(current_superuser)
):
    with errores_http():
        return await servicio.actualizar_categoria(db, id_categoria, data)


@router.delete(
    "/{id_categoria}",
    summary="Eliminar categoría",
    description="Elimina una categoría existente",
    status_code=status.HTTP_204_NO_CONTENT
)
async def eliminar_categoria(
    id_categoria:int,
    db:AsyncSession = Depends(get_db),
    user = Depends(current_superuser)
):
    with errores_http():
        await servicio.eliminar_categoria(db, id_categoria)
