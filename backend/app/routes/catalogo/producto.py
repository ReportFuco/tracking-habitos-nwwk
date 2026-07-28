from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.fastapi_users import current_superuser, current_user_or_api_key
from app.db import get_db
from app.models import CategoriaProducto, Marca, Producto, SubcategoriaProducto
from app.schemas.catalogo import ProductoCreate, ProductoPatch, ProductoResponse

router = APIRouter(prefix="/producto", tags=["Catalogo · Producto"])

async def _obtener_producto(db: AsyncSession, id_producto: int) -> Producto:
    producto = await db.scalar(
        select(Producto)
        .where(Producto.id_producto == id_producto)
        .options(
            selectinload(Producto.categoria_rel),
            selectinload(Producto.subcategoria_rel),
        )
    )
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return producto


async def _validar_categoria_subcategoria(
    db: AsyncSession,
    id_categoria: int | None,
    id_subcategoria: int | None,
) -> tuple[int | None, int | None]:
    if id_categoria is not None:
        categoria = await db.scalar(
            select(CategoriaProducto).where(CategoriaProducto.id_categoria == id_categoria)
        )
        if not categoria:
            raise HTTPException(status_code=404, detail="Categoria no encontrada")

    if id_subcategoria is not None:
        subcategoria = await db.scalar(
            select(SubcategoriaProducto).where(SubcategoriaProducto.id_subcategoria == id_subcategoria)
        )
        if not subcategoria:
            raise HTTPException(status_code=404, detail="Subcategoria no encontrada")
        if id_categoria is None:
            id_categoria = subcategoria.id_categoria
        elif subcategoria.id_categoria != id_categoria:
            raise HTTPException(
                status_code=400,
                detail="La subcategoria no pertenece a la categoria enviada",
            )

    return id_categoria, id_subcategoria


@router.get("/", response_model=list[ProductoResponse], status_code=status.HTTP_200_OK)
async def obtener_productos(db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    result = await db.execute(
        select(Producto)
        .options(
            selectinload(Producto.categoria_rel),
            selectinload(Producto.subcategoria_rel),
        )
        .order_by(Producto.nombre_producto)
    )
    return result.scalars().all()

@router.get("/{id_producto}", response_model=ProductoResponse, status_code=status.HTTP_200_OK)
async def obtener_producto(id_producto: int, db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    return await _obtener_producto(db, id_producto)

@router.post("/", response_model=ProductoResponse, status_code=status.HTTP_201_CREATED)
async def crear_producto(data: ProductoCreate, db: AsyncSession = Depends(get_db), user=Depends(current_superuser)):
    marca = await db.scalar(select(Marca).where(Marca.id_marca == data.id_marca))
    if not marca:
        raise HTTPException(status_code=404, detail="Marca no encontrada")
    existente = await db.scalar(select(Producto).where(Producto.codigo_barra == data.codigo_barra))
    if existente:
        raise HTTPException(status_code=409, detail="El codigo de barra ya existe")
    payload = data.model_dump()
    payload["id_categoria"], payload["id_subcategoria"] = await _validar_categoria_subcategoria(
        db=db,
        id_categoria=payload.get("id_categoria"),
        id_subcategoria=payload.get("id_subcategoria"),
    )
    producto = Producto(**payload)
    db.add(producto)
    await db.flush()
    await db.refresh(
        producto,
        attribute_names=["categoria_rel", "subcategoria_rel"],
    )
    return producto

@router.patch("/{id_producto}", response_model=ProductoResponse, status_code=status.HTTP_200_OK)
async def editar_producto(id_producto: int, data: ProductoPatch, db: AsyncSession = Depends(get_db), user=Depends(current_superuser)):
    producto = await _obtener_producto(db, id_producto)
    cambios = data.model_dump(exclude_unset=True)
    if not cambios:
        raise HTTPException(status_code=400, detail="No se enviaron cambios")
    if "id_marca" in cambios:
        marca = await db.scalar(select(Marca).where(Marca.id_marca == cambios["id_marca"]))
        if not marca:
            raise HTTPException(status_code=404, detail="Marca no encontrada")
    if "codigo_barra" in cambios:
        duplicado = await db.scalar(select(Producto).where(Producto.codigo_barra == cambios["codigo_barra"], Producto.id_producto != id_producto))
        if duplicado:
            raise HTTPException(status_code=409, detail="El codigo de barra ya existe")
    if (
        "id_categoria" in cambios
        and "id_subcategoria" not in cambios
        and cambios["id_categoria"] != producto.id_categoria
    ):
        cambios["id_subcategoria"] = None
    if "id_categoria" in cambios and cambios["id_categoria"] is None and "id_subcategoria" not in cambios:
        cambios["id_subcategoria"] = None
    if "id_categoria" in cambios or "id_subcategoria" in cambios:
        id_categoria_objetivo, id_subcategoria_objetivo = await _validar_categoria_subcategoria(
            db=db,
            id_categoria=cambios.get("id_categoria", producto.id_categoria),
            id_subcategoria=cambios.get("id_subcategoria", producto.id_subcategoria),
        )
        cambios["id_categoria"] = id_categoria_objetivo
        cambios["id_subcategoria"] = id_subcategoria_objetivo
    for field, value in cambios.items():
        setattr(producto, field, value)
    await db.flush()
    await db.refresh(
        producto,
        attribute_names=["categoria_rel", "subcategoria_rel"],
    )
    return producto

@router.delete("/{id_producto}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_producto(id_producto: int, db: AsyncSession = Depends(get_db), user=Depends(current_superuser)):
    producto = await _obtener_producto(db, id_producto)
    producto.activo = False
