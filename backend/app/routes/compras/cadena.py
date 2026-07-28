from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.fastapi_users import current_superuser, current_user_or_api_key
from app.db import get_db
from app.models import Cadena
from app.schemas.compras import CadenaCreate, CadenaPatch, CadenaResponse

router = APIRouter(prefix="/cadena", tags=["Compras · Cadena"])

@router.get("/", response_model=list[CadenaResponse], status_code=status.HTTP_200_OK)
async def obtener_cadenas(db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    result = await db.execute(select(Cadena).order_by(Cadena.nombre_cadena))
    return result.scalars().all()

@router.get("/{id_cadena}", response_model=CadenaResponse, status_code=status.HTTP_200_OK)
async def obtener_cadena(id_cadena: int, db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    cadena = await db.scalar(select(Cadena).where(Cadena.id_cadena == id_cadena))
    if not cadena:
        raise HTTPException(status_code=404, detail="Cadena no encontrada")
    return cadena

@router.post("/", response_model=CadenaResponse, status_code=status.HTTP_201_CREATED)
async def crear_cadena(data: CadenaCreate, db: AsyncSession = Depends(get_db), user=Depends(current_superuser)):
    existente = await db.scalar(select(Cadena).where(Cadena.nombre_cadena == data.nombre_cadena))
    if existente:
        raise HTTPException(status_code=409, detail="La cadena ya existe")
    cadena = Cadena(**data.model_dump())
    db.add(cadena)
    await db.flush()
    await db.refresh(cadena)
    return cadena

@router.patch("/{id_cadena}", response_model=CadenaResponse, status_code=status.HTTP_200_OK)
async def editar_cadena(id_cadena: int, data: CadenaPatch, db: AsyncSession = Depends(get_db), user=Depends(current_superuser)):
    cadena = await db.scalar(select(Cadena).where(Cadena.id_cadena == id_cadena))
    if not cadena:
        raise HTTPException(status_code=404, detail="Cadena no encontrada")
    cambios = data.model_dump(exclude_unset=True)
    if not cambios:
        raise HTTPException(status_code=400, detail="No se enviaron cambios")
    if "nombre_cadena" in cambios:
        duplicada = await db.scalar(select(Cadena).where(Cadena.nombre_cadena == cambios["nombre_cadena"], Cadena.id_cadena != id_cadena))
        if duplicada:
            raise HTTPException(status_code=409, detail="La cadena ya existe")
    for field, value in cambios.items():
        setattr(cadena, field, value)
    await db.flush()
    await db.refresh(cadena)
    return cadena

@router.delete("/{id_cadena}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_cadena(id_cadena: int, db: AsyncSession = Depends(get_db), user=Depends(current_superuser)):
    cadena = await db.scalar(select(Cadena).where(Cadena.id_cadena == id_cadena))
    if not cadena:
        raise HTTPException(status_code=404, detail="Cadena no encontrada")
    await db.delete(cadena)
