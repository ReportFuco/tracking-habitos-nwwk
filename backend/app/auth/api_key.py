import hashlib
import hmac
import secrets
from datetime import datetime

from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import ApiKey, User


API_KEY_PREFIX = "thw"
API_KEY_SECRET_BYTES = 32


def generate_api_key() -> tuple[str, str, str]:
    secret = secrets.token_urlsafe(API_KEY_SECRET_BYTES)
    api_key = f"{API_KEY_PREFIX}_{secret}"
    return api_key, api_key[:12], hash_api_key(api_key)


def hash_api_key(api_key: str) -> str:
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()


def get_client_ip(request: Request) -> str | None:
    x_real_ip = request.headers.get("x-real-ip")
    if x_real_ip:
        return x_real_ip.strip()

    x_forwarded_for = request.headers.get("x-forwarded-for")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()

    return request.client.host if request.client else None


async def get_user_by_api_key(
    api_key_value: str,
    request: Request,
    db: AsyncSession,
) -> User:
    candidate_hash = hash_api_key(api_key_value)
    result = await db.execute(
        select(ApiKey)
        .join(User, User.id == ApiKey.auth_user_id)
        .where(
            ApiKey.key_prefix == api_key_value[:12],
            ApiKey.activo.is_(True),
            User.is_active.is_(True),
        )
    )
    api_key = next(
        (
            item
            for item in result.scalars()
            if hmac.compare_digest(item.key_hash, candidate_hash)
        ),
        None,
    )

    if api_key is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key invalida.",
        )

    await db.execute(
        update(ApiKey)
        .where(ApiKey.id_api_key == api_key.id_api_key)
        .values(
            last_used_at=datetime.now(),
            last_used_ip=get_client_ip(request),
            usage_count=ApiKey.usage_count + 1,
        )
    )

    user = await db.get(User, api_key.auth_user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario de API key no disponible.",
        )

    return user


async def optional_api_key_user(
    request: Request,
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    if not x_api_key:
        return None

    return await get_user_by_api_key(x_api_key, request, db)


async def current_api_key_user(
    request: Request,
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key requerida.",
        )

    return await get_user_by_api_key(x_api_key, request, db)
