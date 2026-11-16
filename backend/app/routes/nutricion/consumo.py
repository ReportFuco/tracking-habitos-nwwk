from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.fastapi_users import current_user_or_api_key
from app.db import get_db
from app.models import Consumo
from app.routes.finanzas._http import errores_http
from app.routes.utils import obtener_usuario_actual
from app.schemas.nutricion import ConsumoCreate, ConsumoPatch, ConsumoResponse
from app.services.nutricion import comidas

router = APIRouter(prefix="/consumo", tags=["Nutricion · Consumo"])


async def _obtener_consumo_usuario(db: AsyncSession, id_consumo: int, id_usuario: int) -> Consumo:
    with errores_http():
        return await comidas.obtener_comida(db, id_usuario, id_consumo)


@router.get("/", response_model=list[ConsumoResponse], status_code=status.HTTP_200_OK)
async def obtener_consumos(db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    usuario = await obtener_usuario_actual(user, db)
    result = await db.execute(
        select(Consumo)
        .where(Consumo.id_usuario == usuario.id_usuario)
        .options(comidas.CON_DETALLES)
        .order_by(Consumo.fecha_consumo.desc())
    )
    return result.scalars().all()


@router.get("/{id_consumo}", response_model=ConsumoResponse, status_code=status.HTTP_200_OK)
async def obtener_consumo(id_consumo: int, db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    usuario = await obtener_usuario_actual(user, db)
    return await _obtener_consumo_usuario(db, id_consumo, usuario.id_usuario)


@router.post("/", response_model=ConsumoResponse, status_code=status.HTTP_201_CREATED)
async def crear_consumo(data: ConsumoCreate, db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    usuario = await obtener_usuario_actual(user, db)
    with errores_http():
        return await comidas.crear_comida(db, usuario.id_usuario, data)


@router.patch("/{id_consumo}", response_model=ConsumoResponse, status_code=status.HTTP_200_OK)
async def editar_consumo(id_consumo: int, data: ConsumoPatch, db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    usuario = await obtener_usuario_actual(user, db)
    consumo = await _obtener_consumo_usuario(db, id_consumo, usuario.id_usuario)
    cambios = data.model_dump(exclude_unset=True)
    if not cambios:
        raise HTTPException(status_code=400, detail="No se enviaron cambios")
    for field, value in cambios.items():
        setattr(consumo, field, value)
    await db.flush()
    return await _obtener_consumo_usuario(db, id_consumo, usuario.id_usuario)


@router.delete("/{id_consumo}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_consumo(id_consumo: int, db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    usuario = await obtener_usuario_actual(user, db)
    consumo = await _obtener_consumo_usuario(db, id_consumo, usuario.id_usuario)
    await db.delete(consumo)
