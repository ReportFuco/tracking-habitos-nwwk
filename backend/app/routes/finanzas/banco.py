from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from sqlalchemy import select
from app.models import Banco, ProductoFinanciero
from app.auth.fastapi_users import current_superuser, current_user_or_api_key
from app.schemas.finanzas import BancoCreate, BancoResponse


router = APIRouter(prefix="/banco", tags=["Finanzas · Bancos"])

@router.get(
    "/",
    response_model=list[BancoResponse],
    summary="Obtener todos los Bancos",
    description="Enpoint encargado de obtener todos los Bancos dentro de la base de datos",
    status_code=status.HTTP_200_OK
)
async def obtener_bancos(
    db: AsyncSession = Depends(get_db),
    user = Depends(current_user_or_api_key)

):
    query = await db.execute(select(Banco))
    banco = query.scalars().all()

    return banco


@router.get(
    "/{id_banco}", 
    response_model=BancoResponse,
    summary="Obtener Banco según su ID",
    description="Obtiene los detalles del banco según su ID",
    status_code=status.HTTP_200_OK
    )
async def obtener_banco_id(
    id_banco:int, 
    db:AsyncSession = Depends(get_db),
    user = Depends(current_user_or_api_key)
):
    query = await db.execute(select(Banco).where(Banco.id_banco == id_banco))
    banco = query.scalar_one_or_none()
    if banco:
        return banco
    else:
        raise HTTPException(status_code=404, detail="Banco no encontrado.")


@router.post(
    "/",
    response_model=BancoResponse,
    summary="Crear Banco",
    description="Enpoint encargado de generar un Banco",
    status_code=status.HTTP_201_CREATED
)
async def crear_banco(
    banco: BancoCreate, 
    db: AsyncSession = Depends(get_db),
    user = Depends(current_superuser)    
):
    query = await db.execute(select(Banco).where(Banco.nombre_banco == banco.nombre_banco))

    banco_existente = query.scalar_one_or_none()
    if banco_existente:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, 
            detail=f"el banco {banco.nombre_banco} ya existe.")
    else:
        registro = Banco(nombre_banco=banco.nombre_banco)
        db.add(registro)
        await db.flush()
        await db.refresh(registro)
        return registro
    

@router.patch(
    "/{id_banco}",
    response_model=BancoResponse,
    summary="Actualizar Banco",
    description="Endpoint encargado de actualizar el nombre de un Banco según su ID",
    status_code=status.HTTP_200_OK
)
async def actualizar_banco(
    id_banco: int, 
    banco: BancoCreate, 
    db: AsyncSession = Depends(get_db),
    user = Depends(current_superuser)
):
    query = await db.execute(
        select(Banco)
        .where(Banco.id_banco == id_banco)
    )
    
    banco_existente = query.scalar_one_or_none()
    if not banco_existente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Banco no encontrado."
        )
    
    banco_nombre_existente = (
        await db.execute(
            select(Banco)
            .where(Banco.nombre_banco == banco.nombre_banco)
        )
    ).scalar_one_or_none()

    if banco_nombre_existente and banco_nombre_existente.id_banco != id_banco:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"el banco {banco.nombre_banco} ya existe."
        )

    banco_existente.nombre_banco = banco.nombre_banco
    await db.flush()
    await db.refresh(banco_existente)
    return banco_existente


@router.delete(
    "/{id_banco}",
    summary="Eliminar Banco",
    description="Endpoint encargado de eliminar un Banco según su ID",
    status_code=status.HTTP_204_NO_CONTENT
)
async def eliminar_banco(
    id_banco:int, 
    db:AsyncSession = Depends(get_db),
    user = Depends(current_superuser)
    
):
    query = await db.execute(select(Banco).where(Banco.id_banco == id_banco))
    banco = query.scalar_one_or_none()
    
    if banco:
        producto_asociado = await db.scalar(
            select(ProductoFinanciero.id_producto_financiero).where(
                ProductoFinanciero.id_banco == id_banco
            )
        )
        if producto_asociado is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No se puede eliminar un banco con productos financieros asociados."
            )
        await db.delete(banco)
    else:
        raise HTTPException(
            status_code=404, 
            detail=f"el Banco de ID {id_banco} no existe."
        )
