from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.fastapi_users import current_user_or_api_key
from app.db import get_db
from app.models import PesoUsuario
from app.routes.utils import obtener_usuario_actual
from app.schemas.nutricion import PesoUsuarioCreate, PesoUsuarioPatch, PesoUsuarioResponse

router = APIRouter(prefix="/peso", tags=["Nutricion · Peso"])

async def _obtener_peso_usuario(db: AsyncSession, id_peso: int, id_usuario: int) -> PesoUsuario:
    peso = await db.scalar(select(PesoUsuario).where(PesoUsuario.id_peso == id_peso, PesoUsuario.id_usuario == id_usuario))
    if not peso:
        raise HTTPException(status_code=404, detail="Registro de peso no encontrado")
    return peso

@router.get("/", response_model=list[PesoUsuarioResponse], status_code=status.HTTP_200_OK)
async def obtener_pesos(db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    usuario = await obtener_usuario_actual(user, db)
    result = await db.execute(select(PesoUsuario).where(PesoUsuario.id_usuario == usuario.id_usuario).order_by(PesoUsuario.fecha_registro.desc()))
    return result.scalars().all()

@router.get("/{id_peso}", response_model=PesoUsuarioResponse, status_code=status.HTTP_200_OK)
async def obtener_peso(id_peso: int, db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    usuario = await obtener_usuario_actual(user, db)
    return await _obtener_peso_usuario(db, id_peso, usuario.id_usuario)

@router.post("/", response_model=PesoUsuarioResponse, status_code=status.HTTP_201_CREATED)
async def crear_peso(data: PesoUsuarioCreate, db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    usuario = await obtener_usuario_actual(user, db)
    peso = PesoUsuario(id_usuario=usuario.id_usuario, **data.model_dump())
    db.add(peso)
    await db.flush()
    await db.refresh(peso)
    return peso

@router.patch("/{id_peso}", response_model=PesoUsuarioResponse, status_code=status.HTTP_200_OK)
async def editar_peso(id_peso: int, data: PesoUsuarioPatch, db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    usuario = await obtener_usuario_actual(user, db)
    peso = await _obtener_peso_usuario(db, id_peso, usuario.id_usuario)
    cambios = data.model_dump(exclude_unset=True)
    if not cambios:
        raise HTTPException(status_code=400, detail="No se enviaron cambios")
    for field, value in cambios.items():
        setattr(peso, field, value)
    await db.flush()
    await db.refresh(peso)
    return peso

@router.delete("/{id_peso}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_peso(id_peso: int, db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    usuario = await obtener_usuario_actual(user, db)
    peso = await _obtener_peso_usuario(db, id_peso, usuario.id_usuario)
    await db.delete(peso)
