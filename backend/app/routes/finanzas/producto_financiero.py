from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.fastapi_users import current_superuser, current_user_or_api_key
from app.db import get_db
from app.models import Banco, CuentaUsuario, ProductoFinanciero
from app.schemas.finanzas import (
    ProductoFinancieroCreate,
    ProductoFinancieroPatch,
    ProductoFinancieroResponse,
)


router = APIRouter(prefix="/producto-financiero", tags=["Finanzas · Productos Financieros"])


async def _obtener_producto_financiero(
    db: AsyncSession,
    id_producto_financiero: int,
) -> ProductoFinanciero:
    producto = await db.scalar(
        select(ProductoFinanciero)
        .where(ProductoFinanciero.id_producto_financiero == id_producto_financiero)
        .options(selectinload(ProductoFinanciero.banco))
    )
    if not producto:
        raise HTTPException(status_code=404, detail="Producto financiero no encontrado")
    return producto


async def _validar_banco(db: AsyncSession, id_banco: int) -> Banco:
    banco = await db.scalar(select(Banco).where(Banco.id_banco == id_banco))
    if not banco:
        raise HTTPException(status_code=404, detail="Banco no encontrado")
    return banco


async def _existe_producto_duplicado(
    db: AsyncSession,
    id_banco: int,
    nombre_producto: str,
    id_producto_excluido: int | None = None,
) -> bool:
    stmt = select(ProductoFinanciero.id_producto_financiero).where(
        ProductoFinanciero.id_banco == id_banco,
        func.lower(ProductoFinanciero.nombre_producto)
        == func.lower(nombre_producto.strip()),
    )
    if id_producto_excluido is not None:
        stmt = stmt.where(ProductoFinanciero.id_producto_financiero != id_producto_excluido)
    return await db.scalar(stmt) is not None


@router.get(
    "/",
    response_model=list[ProductoFinancieroResponse],
    status_code=status.HTTP_200_OK,
)
async def obtener_productos_financieros(
    id_banco: int | None = Query(default=None),
    q: str | None = Query(default=None, min_length=1),
    incluir_inactivos: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
    user=Depends(current_user_or_api_key),
):
    stmt = select(ProductoFinanciero).options(selectinload(ProductoFinanciero.banco))

    if id_banco is not None:
        stmt = stmt.where(ProductoFinanciero.id_banco == id_banco)

    if not incluir_inactivos:
        stmt = stmt.where(ProductoFinanciero.activo.is_(True))

    if q:
        termino = q.strip()
        stmt = stmt.where(
            or_(
                func.lower(ProductoFinanciero.nombre_producto).ilike(
                    f"%{termino.lower()}%"
                ),
                func.lower(Banco.nombre_banco).ilike(f"%{termino.lower()}%"),
            )
        ).join(Banco)

    stmt = stmt.order_by(ProductoFinanciero.nombre_producto.asc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get(
    "/{id_producto_financiero}",
    response_model=ProductoFinancieroResponse,
    status_code=status.HTTP_200_OK,
)
async def obtener_producto_financiero(
    id_producto_financiero: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(current_user_or_api_key),
):
    return await _obtener_producto_financiero(db, id_producto_financiero)


@router.post(
    "/",
    response_model=ProductoFinancieroResponse,
    status_code=status.HTTP_201_CREATED,
)
async def crear_producto_financiero(
    data: ProductoFinancieroCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(current_superuser),
):
    await _validar_banco(db, data.id_banco)

    if await _existe_producto_duplicado(db, data.id_banco, data.nombre_producto):
        raise HTTPException(
            status_code=409,
            detail="Ya existe un producto financiero con ese nombre para el banco",
        )

    producto = ProductoFinanciero(
        id_banco=data.id_banco,
        nombre_producto=data.nombre_producto.strip(),
        descripcion=data.descripcion,
    )
    db.add(producto)
    await db.flush()
    await db.refresh(producto, attribute_names=["banco"])
    return producto


@router.patch(
    "/{id_producto_financiero}",
    response_model=ProductoFinancieroResponse,
    status_code=status.HTTP_200_OK,
)
async def editar_producto_financiero(
    id_producto_financiero: int,
    data: ProductoFinancieroPatch,
    db: AsyncSession = Depends(get_db),
    user=Depends(current_superuser),
):
    producto = await _obtener_producto_financiero(db, id_producto_financiero)
    cambios = data.model_dump(exclude_unset=True)

    if not cambios:
        raise HTTPException(status_code=400, detail="No se enviaron cambios")

    id_banco = cambios.get("id_banco", producto.id_banco)
    nombre_producto = cambios.get("nombre_producto", producto.nombre_producto)

    if "id_banco" in cambios:
        await _validar_banco(db, id_banco)

    if "nombre_producto" in cambios:
        cambios["nombre_producto"] = nombre_producto.strip()
        nombre_producto = cambios["nombre_producto"]

    if (
        "id_banco" in cambios
        or "nombre_producto" in cambios
    ) and await _existe_producto_duplicado(
        db,
        id_banco=id_banco,
        nombre_producto=nombre_producto,
        id_producto_excluido=id_producto_financiero,
    ):
        raise HTTPException(
            status_code=409,
            detail="Ya existe un producto financiero con ese nombre para el banco",
        )

    for field, value in cambios.items():
        setattr(producto, field, value)

    await db.flush()
    await db.refresh(producto, attribute_names=["banco"])
    return producto


@router.delete(
    "/{id_producto_financiero}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def eliminar_producto_financiero(
    id_producto_financiero: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(current_superuser),
):
    producto = await _obtener_producto_financiero(db, id_producto_financiero)

    cuenta_asociada = await db.scalar(
        select(CuentaUsuario.id_cuenta).where(
            CuentaUsuario.id_producto_financiero == id_producto_financiero,
            CuentaUsuario.activo.is_(True),
        )
    )
    if cuenta_asociada is not None:
        raise HTTPException(
            status_code=409,
            detail="No se puede desactivar un producto financiero con cuentas activas asociadas",
        )

    producto.activo = False
