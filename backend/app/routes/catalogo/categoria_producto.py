from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.fastapi_users import current_superuser, current_user_or_api_key
from app.db import get_db
from app.models import CategoriaProducto, Producto, SubcategoriaProducto
from app.schemas.catalogo import (
    CategoriaProductoCreate,
    CategoriaProductoPatch,
    CategoriaProductoResponse,
)

router = APIRouter(prefix="/categoria-producto", tags=["Catalogo · Categoria Producto"])


@router.get("/", response_model=list[CategoriaProductoResponse], status_code=status.HTTP_200_OK)
async def obtener_categorias_producto(db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    result = await db.execute(select(CategoriaProducto).order_by(CategoriaProducto.nombre_categoria))
    return result.scalars().all()


@router.get("/{id_categoria}", response_model=CategoriaProductoResponse, status_code=status.HTTP_200_OK)
async def obtener_categoria_producto(id_categoria: int, db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    categoria = await db.scalar(select(CategoriaProducto).where(CategoriaProducto.id_categoria == id_categoria))
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria no encontrada")
    return categoria


@router.post("/", response_model=CategoriaProductoResponse, status_code=status.HTTP_201_CREATED)
async def crear_categoria_producto(
    data: CategoriaProductoCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(current_superuser),
):
    existente = await db.scalar(
        select(CategoriaProducto).where(CategoriaProducto.nombre_categoria == data.nombre_categoria)
    )
    if existente:
        raise HTTPException(status_code=409, detail="La categoria ya existe")
    categoria = CategoriaProducto(**data.model_dump())
    db.add(categoria)
    await db.flush()
    await db.refresh(categoria)
    return categoria


@router.patch("/{id_categoria}", response_model=CategoriaProductoResponse, status_code=status.HTTP_200_OK)
async def editar_categoria_producto(
    id_categoria: int,
    data: CategoriaProductoPatch,
    db: AsyncSession = Depends(get_db),
    user=Depends(current_superuser),
):
    categoria = await db.scalar(select(CategoriaProducto).where(CategoriaProducto.id_categoria == id_categoria))
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria no encontrada")
    cambios = data.model_dump(exclude_unset=True)
    if not cambios:
        raise HTTPException(status_code=400, detail="No se enviaron cambios")
    if "nombre_categoria" in cambios:
        duplicada = await db.scalar(
            select(CategoriaProducto).where(
                CategoriaProducto.nombre_categoria == cambios["nombre_categoria"],
                CategoriaProducto.id_categoria != id_categoria,
            )
        )
        if duplicada:
            raise HTTPException(status_code=409, detail="La categoria ya existe")
    for field, value in cambios.items():
        setattr(categoria, field, value)
    await db.flush()
    await db.refresh(categoria)
    return categoria


@router.delete("/{id_categoria}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_categoria_producto(
    id_categoria: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(current_superuser),
):
    categoria = await db.scalar(select(CategoriaProducto).where(CategoriaProducto.id_categoria == id_categoria))
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria no encontrada")

    subcategoria_asociada = await db.scalar(
        select(SubcategoriaProducto.id_subcategoria)
        .where(SubcategoriaProducto.id_categoria == id_categoria)
        .limit(1)
    )
    if subcategoria_asociada:
        raise HTTPException(status_code=409, detail="No se puede eliminar: la categoria tiene subcategorias asociadas")

    producto_asociado = await db.scalar(
        select(Producto.id_producto).where(Producto.id_categoria == id_categoria).limit(1)
    )
    if producto_asociado:
        raise HTTPException(status_code=409, detail="No se puede eliminar: la categoria tiene productos asociados")

    await db.delete(categoria)
