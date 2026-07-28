from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import CategoriaFinanza
from app.db import get_db
from sqlalchemy import select
from app.auth.fastapi_users import current_superuser, current_user_or_api_key
from app.schemas.finanzas import (
    CategoriaResponse, 
    CategoriaCreate, 
    CategoriaPatch
)


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
    categoria = (await db.execute(select(CategoriaFinanza))).scalars().all()
    
    return categoria


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
    query = await db.execute(
        select(CategoriaFinanza).where(CategoriaFinanza.id_categoria == id_categoria)
    )
    categoria = query.scalar_one_or_none()
    if not categoria:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Categoría no encontrada")
    
    return categoria


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
    query = await db.execute(
        select(CategoriaFinanza)
        .where(CategoriaFinanza.nombre == data.nombre)
    )

    categoria = query.scalar_one_or_none()

    if categoria:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, 
            detail="Categoría ya existe"
        )

    ingreso_categoria = CategoriaFinanza(nombre=data.nombre)
    db.add(ingreso_categoria)
    await db.flush()

    return ingreso_categoria


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
    categoria = (
        await db.execute(
            select(CategoriaFinanza)
            .where(CategoriaFinanza.id_categoria == id_categoria)
        )
    ).scalar_one_or_none()

    if not categoria:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Categoría no encontrada"
        )
    
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(categoria, field, value)

    await db.refresh(categoria)

    return categoria


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
    categoria = (
        await db.execute(
            select(CategoriaFinanza)
            .where(CategoriaFinanza.id_categoria == id_categoria)
        )
    ).scalar_one_or_none()

    if categoria:
        await db.delete(categoria)
    
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Categoría no encontrada")