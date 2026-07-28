from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.fastapi_users import current_superuser, current_user_or_api_key
from app.db import get_db
from app.models import Cadena, Local
from app.schemas.compras import LocalCreate, LocalPatch, LocalResponse

router = APIRouter(prefix="/local", tags=["Compras · Local"])

async def _obtener_local(db: AsyncSession, id_local: int) -> Local:
    local = await db.scalar(
        select(Local)
        .where(Local.id_local == id_local)
        .options(selectinload(Local.cadena))
    )
    if not local:
        raise HTTPException(status_code=404, detail="Local no encontrado")
    return local

@router.get("/", response_model=list[LocalResponse], status_code=status.HTTP_200_OK)
async def obtener_locales(db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    result = await db.execute(
        select(Local)
        .options(selectinload(Local.cadena))
        .order_by(Local.nombre_local)
    )
    return result.scalars().all()

@router.get("/{id_local}", response_model=LocalResponse, status_code=status.HTTP_200_OK)
async def obtener_local(id_local: int, db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    return await _obtener_local(db, id_local)

@router.post("/", response_model=LocalResponse, status_code=status.HTTP_201_CREATED)
async def crear_local(data: LocalCreate, db: AsyncSession = Depends(get_db), user=Depends(current_superuser)):
    if data.id_cadena is not None:
        cadena = await db.scalar(select(Cadena).where(Cadena.id_cadena == data.id_cadena))
        if not cadena:
            raise HTTPException(status_code=404, detail="Cadena no encontrada")
    local = Local(**data.model_dump())
    db.add(local)
    await db.flush()
    await db.refresh(local, attribute_names=["cadena"])
    return local

@router.patch("/{id_local}", response_model=LocalResponse, status_code=status.HTTP_200_OK)
async def editar_local(id_local: int, data: LocalPatch, db: AsyncSession = Depends(get_db), user=Depends(current_superuser)):
    local = await _obtener_local(db, id_local)
    cambios = data.model_dump(exclude_unset=True)
    if not cambios:
        raise HTTPException(status_code=400, detail="No se enviaron cambios")
    if "id_cadena" in cambios and cambios["id_cadena"] is not None:
        cadena = await db.scalar(select(Cadena).where(Cadena.id_cadena == cambios["id_cadena"]))
        if not cadena:
            raise HTTPException(status_code=404, detail="Cadena no encontrada")
    for field, value in cambios.items():
        setattr(local, field, value)
    await db.flush()
    await db.refresh(local, attribute_names=["cadena"])
    return local

@router.delete("/{id_local}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_local(id_local: int, db: AsyncSession = Depends(get_db), user=Depends(current_superuser)):
    local = await _obtener_local(db, id_local)
    await db.delete(local)
