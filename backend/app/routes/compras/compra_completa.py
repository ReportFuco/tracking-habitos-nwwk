from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.fastapi_users import current_user_or_api_key
from app.db import get_db
from app.routes.compras.compra import crear_compra_completa as _crear_compra_completa
from app.schemas.compras import CompraCompletaCreate, CompraResponse


router = APIRouter(prefix="/compra-completa", tags=["Compras · Compra Completa"])


@router.post("/", response_model=CompraResponse, status_code=status.HTTP_201_CREATED)
async def crear_compra_completa(
    data: CompraCompletaCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(current_user_or_api_key),
):
    return await _crear_compra_completa(data=data, db=db, user=user)
