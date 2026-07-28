from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.fastapi_users import current_user_or_api_key
from app.db import get_db
from app.models import Compra, CompraDetalle, CuentaUsuario, Local, Movimiento, MovimientoCompra, Producto
from app.routes.utils import obtener_usuario_actual
from app.schemas.compras import CompraCompletaCreate, CompraCreate, CompraPatch, CompraResponse
from app.models.finanzas import EnumTipoMovimiento

router = APIRouter(prefix="/compra", tags=["Compras · Compra"])

async def _obtener_compra_usuario(db: AsyncSession, id_compra: int, id_usuario: int) -> Compra:
    compra = await db.scalar(
        select(Compra)
        .where(Compra.id_compra == id_compra, Compra.id_usuario == id_usuario)
        .options(
            selectinload(Compra.local).selectinload(Local.cadena),
            selectinload(Compra.detalles),
            selectinload(Compra.vinculos_movimiento)
            .selectinload(MovimientoCompra.movimiento)
            .selectinload(Movimiento.cuenta),
        )
    )
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")
    return compra


async def _obtener_movimiento_gasto_usuario(db: AsyncSession, id_movimiento: int, id_usuario: int) -> Movimiento:
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

@router.get("/", response_model=list[CompraResponse], status_code=status.HTTP_200_OK)
async def obtener_compras(db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    usuario = await obtener_usuario_actual(user, db)
    result = await db.execute(
        select(Compra)
        .where(Compra.id_usuario == usuario.id_usuario)
        .options(
            selectinload(Compra.local).selectinload(Local.cadena),
            selectinload(Compra.detalles),
            selectinload(Compra.vinculos_movimiento)
            .selectinload(MovimientoCompra.movimiento)
            .selectinload(Movimiento.cuenta),
        )
        .order_by(Compra.fecha_compra.desc())
    )
    return result.scalars().all()

@router.get("/{id_compra}", response_model=CompraResponse, status_code=status.HTTP_200_OK)
async def obtener_compra(id_compra: int, db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    usuario = await obtener_usuario_actual(user, db)
    return await _obtener_compra_usuario(db, id_compra, usuario.id_usuario)

@router.post("/", response_model=CompraResponse, status_code=status.HTTP_201_CREATED)
async def crear_compra(data: CompraCreate, db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    usuario = await obtener_usuario_actual(user, db)
    local = await db.scalar(select(Local).where(Local.id_local == data.id_local))
    if not local:
        raise HTTPException(status_code=404, detail="Local no encontrado")
    compra = Compra(id_usuario=usuario.id_usuario, **data.model_dump())
    db.add(compra)
    await db.flush()
    return await _obtener_compra_usuario(db, compra.id_compra, usuario.id_usuario)

@router.patch("/{id_compra}", response_model=CompraResponse, status_code=status.HTTP_200_OK)
async def editar_compra(id_compra: int, data: CompraPatch, db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    usuario = await obtener_usuario_actual(user, db)
    compra = await _obtener_compra_usuario(db, id_compra, usuario.id_usuario)
    cambios = data.model_dump(exclude_unset=True)
    if not cambios:
        raise HTTPException(status_code=400, detail="No se enviaron cambios")
    if "id_local" in cambios:
        local = await db.scalar(select(Local).where(Local.id_local == cambios["id_local"]))
        if not local:
            raise HTTPException(status_code=404, detail="Local no encontrado")
    for field, value in cambios.items():
        setattr(compra, field, value)
    await db.flush()
    return await _obtener_compra_usuario(db, compra.id_compra, usuario.id_usuario)


@router.post("/completa", response_model=CompraResponse, status_code=status.HTTP_201_CREATED)
async def crear_compra_completa(
    data: CompraCompletaCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(current_user_or_api_key),
):
    usuario = await obtener_usuario_actual(user, db)

    local = await db.scalar(select(Local).where(Local.id_local == data.id_local))
    if not local:
        raise HTTPException(status_code=404, detail="Local no encontrado")

    movimiento = None
    if data.id_movimiento is not None:
        movimiento = await _obtener_movimiento_gasto_usuario(db, data.id_movimiento, usuario.id_usuario)

    compra = Compra(
        id_usuario=usuario.id_usuario,
        id_local=data.id_local,
        fecha_compra=data.fecha_compra,
    )
    db.add(compra)
    await db.flush()

    for detalle_data in data.detalles:
        producto = await db.scalar(select(Producto).where(Producto.id_producto == detalle_data.id_producto))
        if not producto:
            raise HTTPException(status_code=404, detail="Producto no encontrado")

        detalle = CompraDetalle(
            id_compra=compra.id_compra,
            **detalle_data.model_dump(),
        )
        db.add(detalle)

    if movimiento is not None:
        db.add(
            MovimientoCompra(
                id_movimiento=movimiento.id_transaccion,
                id_compra=compra.id_compra,
                monto_asociado=data.monto_asociado,
            )
        )

    await db.flush()
    return await _obtener_compra_usuario(db, compra.id_compra, usuario.id_usuario)

@router.delete("/{id_compra}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_compra(id_compra: int, db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    usuario = await obtener_usuario_actual(user, db)
    compra = await _obtener_compra_usuario(db, id_compra, usuario.id_usuario)
    await db.delete(compra)
