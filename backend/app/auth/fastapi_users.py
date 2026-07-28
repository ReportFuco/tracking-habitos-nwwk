from fastapi_users import FastAPIUsers
from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.usuario_auth import User
from app.auth.api_key import get_user_by_api_key
from app.auth.manager import get_user_manager
from app.auth.backend import jwt_auth_backend
from app.db import get_db


fastapi_users = FastAPIUsers[User, int](
    get_user_manager,
    [jwt_auth_backend],
)

current_user = fastapi_users.current_user(active=True)
current_superuser = fastapi_users.current_user(active=True, superuser=True)
optional_current_user = fastapi_users.current_user(active=True, optional=True)


async def current_user_or_api_key(
    request: Request,
    user: User | None = Depends(optional_current_user),
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    db: AsyncSession = Depends(get_db),
) -> User:
    if user is not None and x_api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usa JWT o API key, no ambos.",
        )
    if user is not None:
        return user
    if x_api_key:
        return await get_user_by_api_key(x_api_key, request, db)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales requeridas.",
    )
