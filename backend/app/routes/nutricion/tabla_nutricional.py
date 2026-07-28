from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.fastapi_users import current_superuser, current_user_or_api_key
from app.db import get_db
from app.models import Producto, TablaNutricional
from app.schemas.nutricion import TablaNutricionalCreate, TablaNutricionalPatch, TablaNutricionalResponse

router = APIRouter(prefix="/tabla", tags=["Nutricion · Tabla nutricional"])

async def _obtener_tabla(db: AsyncSession, id_tabla: int) -> TablaNutricional:
    tabla = await db.scalar(select(TablaNutricional).where(TablaNutricional.id_tabla == id_tabla))
    if not tabla:
        raise HTTPException(status_code=404, detail="Tabla nutricional no encontrada")
    return tabla

@router.get("/", response_model=list[TablaNutricionalResponse], status_code=status.HTTP_200_OK)
async def obtener_tablas(db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    result = await db.execute(select(TablaNutricional).order_by(TablaNutricional.id_tabla.desc()))
    return result.scalars().all()

@router.get("/{id_tabla}", response_model=TablaNutricionalResponse, status_code=status.HTTP_200_OK)
async def obtener_tabla(id_tabla: int, db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    return await _obtener_tabla(db, id_tabla)

@router.post("/", response_model=TablaNutricionalResponse, status_code=status.HTTP_201_CREATED)
async def crear_tabla(data: TablaNutricionalCreate, db: AsyncSession = Depends(get_db), user=Depends(current_superuser)):
    producto = await db.scalar(select(Producto).where(Producto.id_producto == data.id_producto))
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    tabla = TablaNutricional(**data.model_dump())
    db.add(tabla)
    await db.flush()
    await db.refresh(tabla)
    return tabla

@router.patch("/{id_tabla}", response_model=TablaNutricionalResponse, status_code=status.HTTP_200_OK)
async def editar_tabla(id_tabla: int, data: TablaNutricionalPatch, db: AsyncSession = Depends(get_db), user=Depends(current_superuser)):
    tabla = await _obtener_tabla(db, id_tabla)
    cambios = data.model_dump(exclude_unset=True)
    if not cambios:
        raise HTTPException(status_code=400, detail="No se enviaron cambios")
    if "id_producto" in cambios:
        producto = await db.scalar(select(Producto).where(Producto.id_producto == cambios["id_producto"]))
        if not producto:
            raise HTTPException(status_code=404, detail="Producto no encontrado")
    for field, value in cambios.items():
        setattr(tabla, field, value)
    await db.flush()
    await db.refresh(tabla)
    return tabla

@router.delete("/{id_tabla}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_tabla(id_tabla: int, db: AsyncSession = Depends(get_db), user=Depends(current_superuser)):
    tabla = await _obtener_tabla(db, id_tabla)
    await db.delete(tabla)
