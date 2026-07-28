from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.fastapi_users import current_user_or_api_key
from app.db import get_db
from app.models import Compra, CompraDetalle, Producto
from app.routes.utils import obtener_usuario_actual
from app.schemas.compras import CompraDetalleCreate, CompraDetallePatch, CompraDetalleResponse

router = APIRouter(prefix="/compra-detalle", tags=["Compras · Detalle"])

async def _obtener_compra_propietaria(db: AsyncSession, id_compra: int, id_usuario: int) -> Compra:
    compra = await db.scalar(select(Compra).where(Compra.id_compra == id_compra, Compra.id_usuario == id_usuario))
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")
    return compra

async def _obtener_detalle_usuario(db: AsyncSession, id_detalle: int, id_usuario: int) -> CompraDetalle:
    detalle = await db.scalar(select(CompraDetalle).join(Compra, Compra.id_compra == CompraDetalle.id_compra).where(CompraDetalle.id_detalle == id_detalle, Compra.id_usuario == id_usuario))
    if not detalle:
        raise HTTPException(status_code=404, detail="Detalle de compra no encontrado")
    return detalle

@router.get("/", response_model=list[CompraDetalleResponse], status_code=status.HTTP_200_OK)
async def obtener_detalles_compra(id_compra: int, db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    usuario = await obtener_usuario_actual(user, db)
    await _obtener_compra_propietaria(db, id_compra, usuario.id_usuario)
    result = await db.execute(select(CompraDetalle).where(CompraDetalle.id_compra == id_compra))
    return result.scalars().all()

@router.get("/{id_detalle}", response_model=CompraDetalleResponse, status_code=status.HTTP_200_OK)
async def obtener_detalle_compra(id_detalle: int, db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    usuario = await obtener_usuario_actual(user, db)
    return await _obtener_detalle_usuario(db, id_detalle, usuario.id_usuario)

@router.post("/", response_model=CompraDetalleResponse, status_code=status.HTTP_201_CREATED)
async def crear_detalle_compra(data: CompraDetalleCreate, db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    usuario = await obtener_usuario_actual(user, db)
    await _obtener_compra_propietaria(db, data.id_compra, usuario.id_usuario)
    producto = await db.scalar(select(Producto).where(Producto.id_producto == data.id_producto))
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    detalle = CompraDetalle(**data.model_dump())
    db.add(detalle)
    await db.flush()
    await db.refresh(detalle)
    return detalle

@router.patch("/{id_detalle}", response_model=CompraDetalleResponse, status_code=status.HTTP_200_OK)
async def editar_detalle_compra(id_detalle: int, data: CompraDetallePatch, db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    usuario = await obtener_usuario_actual(user, db)
    detalle = await _obtener_detalle_usuario(db, id_detalle, usuario.id_usuario)
    cambios = data.model_dump(exclude_unset=True)
    if not cambios:
        raise HTTPException(status_code=400, detail="No se enviaron cambios")
    if "id_producto" in cambios:
        producto = await db.scalar(select(Producto).where(Producto.id_producto == cambios["id_producto"]))
        if not producto:
            raise HTTPException(status_code=404, detail="Producto no encontrado")
    for field, value in cambios.items():
        setattr(detalle, field, value)
    await db.flush()
    await db.refresh(detalle)
    return detalle

@router.delete("/{id_detalle}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_detalle_compra(id_detalle: int, db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    usuario = await obtener_usuario_actual(user, db)
    detalle = await _obtener_detalle_usuario(db, id_detalle, usuario.id_usuario)
    await db.delete(detalle)
