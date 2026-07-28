from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.fastapi_users import current_superuser, current_user_or_api_key
from app.db import get_db
from app.models import CategoriaProducto, Producto, SubcategoriaProducto
from app.schemas.catalogo import (
    SubcategoriaProductoCreate,
    SubcategoriaProductoPatch,
    SubcategoriaProductoResponse,
)

router = APIRouter(prefix="/subcategoria-producto", tags=["Catalogo · Subcategoria Producto"])


@router.get("/", response_model=list[SubcategoriaProductoResponse], status_code=status.HTTP_200_OK)
async def obtener_subcategorias_producto(db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    result = await db.execute(
        select(SubcategoriaProducto).order_by(SubcategoriaProducto.id_categoria, SubcategoriaProducto.nombre_subcategoria)
    )
    return result.scalars().all()


@router.get("/{id_subcategoria}", response_model=SubcategoriaProductoResponse, status_code=status.HTTP_200_OK)
async def obtener_subcategoria_producto(
    id_subcategoria: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(current_user_or_api_key),
):
    subcategoria = await db.scalar(
        select(SubcategoriaProducto).where(SubcategoriaProducto.id_subcategoria == id_subcategoria)
    )
    if not subcategoria:
        raise HTTPException(status_code=404, detail="Subcategoria no encontrada")
    return subcategoria


@router.post("/", response_model=SubcategoriaProductoResponse, status_code=status.HTTP_201_CREATED)
async def crear_subcategoria_producto(
    data: SubcategoriaProductoCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(current_superuser),
):
    categoria = await db.scalar(select(CategoriaProducto).where(CategoriaProducto.id_categoria == data.id_categoria))
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria no encontrada")

    existente = await db.scalar(
        select(SubcategoriaProducto).where(
            SubcategoriaProducto.id_categoria == data.id_categoria,
            SubcategoriaProducto.nombre_subcategoria == data.nombre_subcategoria,
        )
    )
    if existente:
        raise HTTPException(status_code=409, detail="La subcategoria ya existe en la categoria indicada")

    subcategoria = SubcategoriaProducto(**data.model_dump())
    db.add(subcategoria)
    await db.flush()
    await db.refresh(subcategoria)
    return subcategoria


@router.patch("/{id_subcategoria}", response_model=SubcategoriaProductoResponse, status_code=status.HTTP_200_OK)
async def editar_subcategoria_producto(
    id_subcategoria: int,
    data: SubcategoriaProductoPatch,
    db: AsyncSession = Depends(get_db),
    user=Depends(current_superuser),
):
    subcategoria = await db.scalar(
        select(SubcategoriaProducto).where(SubcategoriaProducto.id_subcategoria == id_subcategoria)
    )
    if not subcategoria:
        raise HTTPException(status_code=404, detail="Subcategoria no encontrada")

    cambios = data.model_dump(exclude_unset=True)
    if not cambios:
        raise HTTPException(status_code=400, detail="No se enviaron cambios")

    id_categoria_objetivo = cambios.get("id_categoria", subcategoria.id_categoria)
    nombre_objetivo = cambios.get("nombre_subcategoria", subcategoria.nombre_subcategoria)

    categoria = await db.scalar(select(CategoriaProducto).where(CategoriaProducto.id_categoria == id_categoria_objetivo))
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria no encontrada")

    duplicada = await db.scalar(
        select(SubcategoriaProducto).where(
            SubcategoriaProducto.id_categoria == id_categoria_objetivo,
            SubcategoriaProducto.nombre_subcategoria == nombre_objetivo,
            SubcategoriaProducto.id_subcategoria != id_subcategoria,
        )
    )
    if duplicada:
        raise HTTPException(status_code=409, detail="La subcategoria ya existe en la categoria indicada")

    for field, value in cambios.items():
        setattr(subcategoria, field, value)
    await db.flush()
    await db.refresh(subcategoria)
    return subcategoria


@router.delete("/{id_subcategoria}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_subcategoria_producto(
    id_subcategoria: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(current_superuser),
):
    subcategoria = await db.scalar(
        select(SubcategoriaProducto).where(SubcategoriaProducto.id_subcategoria == id_subcategoria)
    )
    if not subcategoria:
        raise HTTPException(status_code=404, detail="Subcategoria no encontrada")

    producto_asociado = await db.scalar(
        select(Producto.id_producto).where(Producto.id_subcategoria == id_subcategoria).limit(1)
    )
    if producto_asociado:
        raise HTTPException(status_code=409, detail="No se puede eliminar: la subcategoria tiene productos asociados")

    await db.delete(subcategoria)
