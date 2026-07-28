from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.fastapi_users import current_superuser, current_user_or_api_key
from app.db import get_db
from app.models import Marca
from app.schemas.catalogo import MarcaCreate, MarcaPatch, MarcaResponse

router = APIRouter(prefix="/marca", tags=["Catalogo · Marca"])

@router.get("/", response_model=list[MarcaResponse], status_code=status.HTTP_200_OK)
async def obtener_marcas(db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    result = await db.execute(select(Marca).order_by(Marca.nombre_marca))
    return result.scalars().all()

@router.get("/{id_marca}", response_model=MarcaResponse, status_code=status.HTTP_200_OK)
async def obtener_marca(id_marca: int, db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    marca = await db.scalar(select(Marca).where(Marca.id_marca == id_marca))
    if not marca:
        raise HTTPException(status_code=404, detail="Marca no encontrada")
    return marca

@router.post("/", response_model=MarcaResponse, status_code=status.HTTP_201_CREATED)
async def crear_marca(data: MarcaCreate, db: AsyncSession = Depends(get_db), user=Depends(current_superuser)):
    existente = await db.scalar(select(Marca).where(Marca.nombre_marca == data.nombre_marca))
    if existente:
        raise HTTPException(status_code=409, detail="La marca ya existe")
    marca = Marca(**data.model_dump())
    db.add(marca)
    await db.flush()
    await db.refresh(marca)
    return marca

@router.patch("/{id_marca}", response_model=MarcaResponse, status_code=status.HTTP_200_OK)
async def editar_marca(id_marca: int, data: MarcaPatch, db: AsyncSession = Depends(get_db), user=Depends(current_superuser)):
    marca = await db.scalar(select(Marca).where(Marca.id_marca == id_marca))
    if not marca:
        raise HTTPException(status_code=404, detail="Marca no encontrada")
    cambios = data.model_dump(exclude_unset=True)
    if not cambios:
        raise HTTPException(status_code=400, detail="No se enviaron cambios")
    if "nombre_marca" in cambios:
        duplicada = await db.scalar(select(Marca).where(Marca.nombre_marca == cambios["nombre_marca"], Marca.id_marca != id_marca))
        if duplicada:
            raise HTTPException(status_code=409, detail="La marca ya existe")
    for field, value in cambios.items():
        setattr(marca, field, value)
    await db.flush()
    await db.refresh(marca)
    return marca

@router.delete("/{id_marca}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_marca(id_marca: int, db: AsyncSession = Depends(get_db), user=Depends(current_superuser)):
    marca = await db.scalar(select(Marca).where(Marca.id_marca == id_marca))
    if not marca:
        raise HTTPException(status_code=404, detail="Marca no encontrada")
    await db.delete(marca)
