from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.fastapi_users import current_user_or_api_key
from app.db import get_db
from app.models import Consumo, ConsumoDetalle
from app.routes.finanzas._http import errores_http
from app.routes.utils import obtener_usuario_actual
from app.schemas.nutricion import ConsumoDetalleCreate, ConsumoDetallePatch, ConsumoDetalleResponse
from app.services.nutricion import calcular_nutrientes, obtener_producto
from app.services.nutricion.calculo import NUTRIENTES

router = APIRouter(prefix="/consumo-detalle", tags=["Nutricion · Detalle consumo"])


async def _obtener_consumo_propietario(db: AsyncSession, id_consumo: int, id_usuario: int) -> Consumo:
    consumo = await db.scalar(select(Consumo).where(Consumo.id_consumo == id_consumo, Consumo.id_usuario == id_usuario))
    if not consumo:
        raise HTTPException(status_code=404, detail="Consumo no encontrado")
    return consumo


async def _obtener_detalle_usuario(db: AsyncSession, id_consumo_detalle: int, id_usuario: int) -> ConsumoDetalle:
    detalle = await db.scalar(
        select(ConsumoDetalle)
        .join(Consumo, Consumo.id_consumo == ConsumoDetalle.id_consumo)
        .where(ConsumoDetalle.id_consumo_detalle == id_consumo_detalle, Consumo.id_usuario == id_usuario)
        .options(selectinload(ConsumoDetalle.producto))
        .execution_options(populate_existing=True)
    )
    if not detalle:
        raise HTTPException(status_code=404, detail="Detalle de consumo no encontrado")
    return detalle


@router.get("/", response_model=list[ConsumoDetalleResponse], status_code=status.HTTP_200_OK)
async def obtener_detalles_consumo(id_consumo: int, db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    usuario = await obtener_usuario_actual(user, db)
    await _obtener_consumo_propietario(db, id_consumo, usuario.id_usuario)
    result = await db.execute(
        select(ConsumoDetalle)
        .where(ConsumoDetalle.id_consumo == id_consumo)
        .options(selectinload(ConsumoDetalle.producto))
        .order_by(ConsumoDetalle.id_consumo_detalle)
    )
    return result.scalars().all()


@router.get("/{id_consumo_detalle}", response_model=ConsumoDetalleResponse, status_code=status.HTTP_200_OK)
async def obtener_detalle_consumo(id_consumo_detalle: int, db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    usuario = await obtener_usuario_actual(user, db)
    return await _obtener_detalle_usuario(db, id_consumo_detalle, usuario.id_usuario)


@router.post("/", response_model=ConsumoDetalleResponse, status_code=status.HTTP_201_CREATED)
async def crear_detalle_consumo(data: ConsumoDetalleCreate, db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    usuario = await obtener_usuario_actual(user, db)
    await _obtener_consumo_propietario(db, data.id_consumo, usuario.id_usuario)
    if data.id_producto is not None:
        with errores_http():
            await obtener_producto(db, data.id_producto)
    valores = data.model_dump()
    explicitos = {campo: valores.pop(campo) for campo in NUTRIENTES}
    detalle = ConsumoDetalle(**valores)
    await calcular_nutrientes(detalle, db, explicitos)
    db.add(detalle)
    await db.flush()
    return await _obtener_detalle_usuario(db, detalle.id_consumo_detalle, usuario.id_usuario)


@router.patch("/{id_consumo_detalle}", response_model=ConsumoDetalleResponse, status_code=status.HTTP_200_OK)
async def editar_detalle_consumo(id_consumo_detalle: int, data: ConsumoDetallePatch, db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    usuario = await obtener_usuario_actual(user, db)
    detalle = await _obtener_detalle_usuario(db, id_consumo_detalle, usuario.id_usuario)
    cambios = data.model_dump(exclude_unset=True)
    if not cambios:
        raise HTTPException(status_code=400, detail="No se enviaron cambios")
    if cambios.get("id_producto") is not None:
        with errores_http():
            await obtener_producto(db, cambios["id_producto"])

    explicitos = {campo: cambios.pop(campo) for campo in NUTRIENTES if campo in cambios}
    for field, value in cambios.items():
        setattr(detalle, field, value)
    if detalle.id_producto is None and detalle.nombre_alimento is None:
        raise HTTPException(status_code=400, detail="La línea necesita un producto o el nombre del alimento")

    if detalle.id_producto is not None and (
        {"id_producto", "cantidad_consumida", "unidad_consumida"} & cambios.keys() or explicitos
    ):
        # Cambió lo que se comió o cuánto: recalcular con la tabla, salvo lo que venga explícito.
        await calcular_nutrientes(detalle, db, explicitos)
    else:
        for campo, valor in explicitos.items():
            setattr(detalle, campo, valor)
    if detalle.id_producto is None and detalle.calorias is None:
        raise HTTPException(status_code=400, detail="Un alimento libre necesita sus calorías")

    await db.flush()
    return await _obtener_detalle_usuario(db, id_consumo_detalle, usuario.id_usuario)


@router.delete("/{id_consumo_detalle}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_detalle_consumo(id_consumo_detalle: int, db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    usuario = await obtener_usuario_actual(user, db)
    detalle = await _obtener_detalle_usuario(db, id_consumo_detalle, usuario.id_usuario)
    await db.delete(detalle)
