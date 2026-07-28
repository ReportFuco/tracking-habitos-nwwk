from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.fastapi_users import current_user_or_api_key
from app.db import get_db
from app.models import Compra, CuentaUsuario, Local, Movimiento, MovimientoCompra
from app.models.finanzas import EnumTipoMovimiento
from app.routes.utils import obtener_usuario_actual
from app.schemas.compras import MovimientoCompraCreate, MovimientoCompraResponse


router = APIRouter(prefix="/movimiento-compra", tags=["Compras · Movimiento Compra"])


async def _obtener_vinculo(db: AsyncSession, id_movimiento_compra: int, id_usuario: int) -> MovimientoCompra:
    vinculo = await db.scalar(
        select(MovimientoCompra)
        .join(Compra, Compra.id_compra == MovimientoCompra.id_compra)
        .where(
            MovimientoCompra.id_movimiento_compra == id_movimiento_compra,
            Compra.id_usuario == id_usuario,
        )
        .options(
            selectinload(MovimientoCompra.compra)
            .selectinload(Compra.local)
            .selectinload(Local.cadena),
            selectinload(MovimientoCompra.compra).selectinload(Compra.detalles),
            selectinload(MovimientoCompra.movimiento).selectinload(Movimiento.cuenta),
        )
    )
    if not vinculo:
        raise HTTPException(status_code=404, detail="Vínculo movimiento-compra no encontrado")
    return vinculo


async def _obtener_movimiento_usuario(db: AsyncSession, id_movimiento: int, id_usuario: int) -> Movimiento:
    movimiento = await db.scalar(
        select(Movimiento)
        .join(CuentaUsuario, Movimiento.id_cuenta == CuentaUsuario.id_cuenta)
        .options(selectinload(Movimiento.cuenta))
        .where(
            Movimiento.id_transaccion == id_movimiento,
            CuentaUsuario.id_usuario == id_usuario,
        )
    )
    if not movimiento:
        raise HTTPException(status_code=404, detail="Movimiento no encontrado")
    if movimiento.tipo_movimiento != EnumTipoMovimiento.GASTO:
        raise HTTPException(status_code=409, detail="Solo se pueden vincular movimientos de gasto")
    return movimiento


async def _obtener_compra_usuario(db: AsyncSession, id_compra: int, id_usuario: int) -> Compra:
    compra = await db.scalar(
        select(Compra)
        .where(Compra.id_compra == id_compra, Compra.id_usuario == id_usuario)
        .options(
            selectinload(Compra.local).selectinload(Local.cadena),
            selectinload(Compra.detalles),
        )
    )
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")
    return compra


@router.get("/", response_model=list[MovimientoCompraResponse], status_code=status.HTTP_200_OK)
async def obtener_vinculos_movimiento_compra(
    id_movimiento: int | None = Query(default=None),
    id_compra: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    user=Depends(current_user_or_api_key),
):
    if id_movimiento is None and id_compra is None:
        raise HTTPException(status_code=400, detail="Debes enviar id_movimiento o id_compra")

    usuario = await obtener_usuario_actual(user, db)

    stmt = (
        select(MovimientoCompra)
        .join(Compra, Compra.id_compra == MovimientoCompra.id_compra)
        .where(Compra.id_usuario == usuario.id_usuario)
        .options(
            selectinload(MovimientoCompra.compra)
            .selectinload(Compra.local)
            .selectinload(Local.cadena),
            selectinload(MovimientoCompra.compra).selectinload(Compra.detalles),
            selectinload(MovimientoCompra.movimiento).selectinload(Movimiento.cuenta),
        )
    )
    if id_movimiento is not None:
        stmt = stmt.where(MovimientoCompra.id_movimiento == id_movimiento)
    if id_compra is not None:
        stmt = stmt.where(MovimientoCompra.id_compra == id_compra)

    result = await db.execute(stmt.order_by(MovimientoCompra.created_at.desc()))
    return result.scalars().all()


@router.post("/", response_model=MovimientoCompraResponse, status_code=status.HTTP_201_CREATED)
async def crear_vinculo_movimiento_compra(
    data: MovimientoCompraCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(current_user_or_api_key),
):
    usuario = await obtener_usuario_actual(user, db)
    await _obtener_movimiento_usuario(db, data.id_movimiento, usuario.id_usuario)
    await _obtener_compra_usuario(db, data.id_compra, usuario.id_usuario)

    existente = await db.scalar(
        select(MovimientoCompra).where(
            MovimientoCompra.id_movimiento == data.id_movimiento,
            MovimientoCompra.id_compra == data.id_compra,
        )
    )
    if existente:
        raise HTTPException(status_code=409, detail="El vínculo movimiento-compra ya existe")

    vinculo = MovimientoCompra(**data.model_dump())
    db.add(vinculo)
    await db.flush()
    return await _obtener_vinculo(db, vinculo.id_movimiento_compra, usuario.id_usuario)


@router.delete("/{id_movimiento_compra}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_vinculo_movimiento_compra(
    id_movimiento_compra: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(current_user_or_api_key),
):
    usuario = await obtener_usuario_actual(user, db)
    vinculo = await _obtener_vinculo(db, id_movimiento_compra, usuario.id_usuario)
    await db.delete(vinculo)
