from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi_users.authentication import AuthenticationBackend, BearerTransport, CookieTransport

from app.auth.jwt import get_jwt_strategy
from app.auth.session import WebSessionStrategy
from app.db import get_db
from app.settings import SESSION_COOKIE_NAME, SESSION_COOKIE_SECURE, SESSION_IDLE_DAYS

bearer_transport = BearerTransport(
    tokenUrl="/auth/jwt/login"
)

jwt_auth_backend = AuthenticationBackend(
    name="jwt",
    transport=bearer_transport,
    get_strategy=get_jwt_strategy,
)

session_cookie_transport = CookieTransport(
    cookie_name=SESSION_COOKIE_NAME,
    cookie_max_age=60 * 60 * 24 * SESSION_IDLE_DAYS,
    cookie_path="/",
    cookie_secure=SESSION_COOKIE_SECURE,
    cookie_httponly=True,
    cookie_samesite="lax",
)


def get_web_session_strategy(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> WebSessionStrategy:
    return WebSessionStrategy(db, request)


web_session_auth_backend = AuthenticationBackend(
    name="session",
    transport=session_cookie_transport,
    get_strategy=get_web_session_strategy,
)
