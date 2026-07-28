from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.fastapi_users import current_user_or_api_key
from app.db import get_db
from app.models import MetaNutricional
from app.routes.utils import obtener_usuario_actual
from app.schemas.nutricion import MetaNutricionalCreate, MetaNutricionalPatch, MetaNutricionalResponse

router = APIRouter(prefix="/meta", tags=["Nutricion · Meta"])

async def _obtener_meta_usuario(db: AsyncSession, id_meta: int, id_usuario: int) -> MetaNutricional:
    meta = await db.scalar(select(MetaNutricional).where(MetaNutricional.id_meta == id_meta, MetaNutricional.id_usuario == id_usuario))
    if not meta:
        raise HTTPException(status_code=404, detail="Meta nutricional no encontrada")
    return meta

@router.get("/", response_model=list[MetaNutricionalResponse], status_code=status.HTTP_200_OK)
async def obtener_metas(db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    usuario = await obtener_usuario_actual(user, db)
    result = await db.execute(select(MetaNutricional).where(MetaNutricional.id_usuario == usuario.id_usuario).order_by(MetaNutricional.fecha_inicio.desc()))
    return result.scalars().all()

@router.get("/{id_meta}", response_model=MetaNutricionalResponse, status_code=status.HTTP_200_OK)
async def obtener_meta(id_meta: int, db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    usuario = await obtener_usuario_actual(user, db)
    return await _obtener_meta_usuario(db, id_meta, usuario.id_usuario)

@router.post("/", response_model=MetaNutricionalResponse, status_code=status.HTTP_201_CREATED)
async def crear_meta(data: MetaNutricionalCreate, db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    usuario = await obtener_usuario_actual(user, db)
    meta = MetaNutricional(id_usuario=usuario.id_usuario, **data.model_dump())
    db.add(meta)
    await db.flush()
    await db.refresh(meta)
    return meta

@router.patch("/{id_meta}", response_model=MetaNutricionalResponse, status_code=status.HTTP_200_OK)
async def editar_meta(id_meta: int, data: MetaNutricionalPatch, db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    usuario = await obtener_usuario_actual(user, db)
    meta = await _obtener_meta_usuario(db, id_meta, usuario.id_usuario)
    cambios = data.model_dump(exclude_unset=True)
    if not cambios:
        raise HTTPException(status_code=400, detail="No se enviaron cambios")
    for field, value in cambios.items():
        setattr(meta, field, value)
    await db.flush()
    await db.refresh(meta)
    return meta

@router.delete("/{id_meta}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_meta(id_meta: int, db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    usuario = await obtener_usuario_actual(user, db)
    meta = await _obtener_meta_usuario(db, id_meta, usuario.id_usuario)
    await db.delete(meta)
