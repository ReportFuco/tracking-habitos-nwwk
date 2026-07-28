from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.api_key import generate_api_key
from app.auth.fastapi_users import current_user, fastapi_users
from app.auth.schemas import (
    ApiKeyCreate,
    ApiKeyCreatedResponse,
    ApiKeyResponse,
    UsuarioAuthCreate,
    UsuarioAuthRead,
)
from app.auth.backend import jwt_auth_backend
from app.db import get_db
from app.models import ApiKey

router = APIRouter(prefix="/auth", tags=["Auth"])

router.include_router(
    fastapi_users.get_auth_router(jwt_auth_backend),
    prefix="/jwt",
)

router.include_router(
    fastapi_users.get_register_router(
        UsuarioAuthRead,
        UsuarioAuthCreate,
    ),
)


@router.post(
    "/api-keys",
    response_model=ApiKeyCreatedResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear API key",
    description="Crea una API key persistente para integraciones y muestra el secreto solo una vez.",
)
async def crear_api_key(
    data: ApiKeyCreate,
    user=Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    for _ in range(3):
        api_key_value, key_prefix, key_hash = generate_api_key()
        api_key = ApiKey(
            auth_user_id=user.id,
            nombre=data.nombre,
            key_prefix=key_prefix,
            key_hash=key_hash,
        )
        db.add(api_key)
        try:
            await db.flush()
            await db.refresh(api_key)
            break
        except IntegrityError:
            await db.rollback()
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No fue posible crear la API key.",
        )

    response = ApiKeyResponse.model_validate(api_key).model_dump()
    return {**response, "api_key": api_key_value}


@router.get(
    "/api-keys",
    response_model=list[ApiKeyResponse],
    summary="Listar API keys",
    description="Lista las API keys del usuario autenticado sin exponer los secretos completos.",
)
async def listar_api_keys(
    incluir_revocadas: bool = Query(default=False),
    user=Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(ApiKey).where(ApiKey.auth_user_id == user.id)
    if not incluir_revocadas:
        query = query.where(ApiKey.activo.is_(True))

    result = await db.execute(query.order_by(ApiKey.created_at.desc()))
    return result.scalars().all()


@router.delete(
    "/api-keys/{id_api_key}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revocar API key",
    description="Desactiva una API key del usuario autenticado.",
)
async def revocar_api_key(
    id_api_key: int,
    user=Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    api_key = await db.scalar(
        select(ApiKey).where(
            ApiKey.id_api_key == id_api_key,
            ApiKey.auth_user_id == user.id,
        )
    )
    if api_key is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key no encontrada.",
        )

    if api_key.activo:
        api_key.activo = False
        api_key.revoked_at = datetime.now()
        await db.flush()
