from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.fastapi_users import current_user_or_api_key
from app.db import get_db
from app.models import Consumo, ConsumoDetalle, Producto
from app.routes.utils import obtener_usuario_actual
from app.schemas.nutricion import ConsumoDetalleCreate, ConsumoDetallePatch, ConsumoDetalleResponse

router = APIRouter(prefix="/consumo-detalle", tags=["Nutricion · Detalle consumo"])

async def _obtener_consumo_propietario(db: AsyncSession, id_consumo: int, id_usuario: int) -> Consumo:
    consumo = await db.scalar(select(Consumo).where(Consumo.id_consumo == id_consumo, Consumo.id_usuario == id_usuario))
    if not consumo:
        raise HTTPException(status_code=404, detail="Consumo no encontrado")
    return consumo

async def _obtener_detalle_usuario(db: AsyncSession, id_consumo_detalle: int, id_usuario: int) -> ConsumoDetalle:
    detalle = await db.scalar(select(ConsumoDetalle).join(Consumo, Consumo.id_consumo == ConsumoDetalle.id_consumo).where(ConsumoDetalle.id_consumo_detalle == id_consumo_detalle, Consumo.id_usuario == id_usuario))
    if not detalle:
        raise HTTPException(status_code=404, detail="Detalle de consumo no encontrado")
    return detalle

@router.get("/", response_model=list[ConsumoDetalleResponse], status_code=status.HTTP_200_OK)
async def obtener_detalles_consumo(id_consumo: int, db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    usuario = await obtener_usuario_actual(user, db)
    await _obtener_consumo_propietario(db, id_consumo, usuario.id_usuario)
    result = await db.execute(select(ConsumoDetalle).where(ConsumoDetalle.id_consumo == id_consumo))
    return result.scalars().all()

@router.get("/{id_consumo_detalle}", response_model=ConsumoDetalleResponse, status_code=status.HTTP_200_OK)
async def obtener_detalle_consumo(id_consumo_detalle: int, db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    usuario = await obtener_usuario_actual(user, db)
    return await _obtener_detalle_usuario(db, id_consumo_detalle, usuario.id_usuario)

@router.post("/", response_model=ConsumoDetalleResponse, status_code=status.HTTP_201_CREATED)
async def crear_detalle_consumo(data: ConsumoDetalleCreate, db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    usuario = await obtener_usuario_actual(user, db)
    await _obtener_consumo_propietario(db, data.id_consumo, usuario.id_usuario)
    producto = await db.scalar(select(Producto).where(Producto.id_producto == data.id_producto))
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    detalle = ConsumoDetalle(**data.model_dump())
    db.add(detalle)
    await db.flush()
    await db.refresh(detalle)
    return detalle

@router.patch("/{id_consumo_detalle}", response_model=ConsumoDetalleResponse, status_code=status.HTTP_200_OK)
async def editar_detalle_consumo(id_consumo_detalle: int, data: ConsumoDetallePatch, db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    usuario = await obtener_usuario_actual(user, db)
    detalle = await _obtener_detalle_usuario(db, id_consumo_detalle, usuario.id_usuario)
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

@router.delete("/{id_consumo_detalle}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_detalle_consumo(id_consumo_detalle: int, db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    usuario = await obtener_usuario_actual(user, db)
    detalle = await _obtener_detalle_usuario(db, id_consumo_detalle, usuario.id_usuario)
    await db.delete(detalle)
