import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Request
from fastapi_users import exceptions
from fastapi_users.manager import BaseUserManager
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, WebSession
from app.settings import SESSION_ABSOLUTE_DAYS, SESSION_IDLE_DAYS


SESSION_TOKEN_BYTES = 48
SESSION_TOUCH_INTERVAL = timedelta(minutes=5)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class WebSessionStrategy:
    def __init__(self, db: AsyncSession, request: Request):
        self.db = db
        self.request = request
        self.idle_lifetime = timedelta(days=SESSION_IDLE_DAYS)
        self.absolute_lifetime = timedelta(days=SESSION_ABSOLUTE_DAYS)

    async def _get_session(self, token: str | None) -> WebSession | None:
        if not token:
            return None

        return await self.db.scalar(
            select(WebSession).where(WebSession.token_hash == hash_session_token(token))
        )

    async def _get_active_session(self, token: str | None) -> WebSession | None:
        web_session = await self._get_session(token)
        if web_session is None or web_session.revoked_at is not None:
            return None

        now = utc_now()
        if web_session.expires_at <= now or web_session.absolute_expires_at <= now:
            return None

        return web_session

    async def read_token(
        self,
        token: str | None,
        user_manager: BaseUserManager[User, int],
    ) -> User | None:
        web_session = await self._get_active_session(token)
        if web_session is None:
            return None

        try:
            user = await user_manager.get(web_session.auth_user_id)
        except exceptions.UserNotExists:
            return None

        now = utc_now()
        if now - web_session.last_used_at >= SESSION_TOUCH_INTERVAL:
            web_session.last_used_at = now
            web_session.last_ip = self.request.client.host if self.request.client else None
            await self.db.flush()

        return user

    async def write_token(self, user: User) -> str:
        token = secrets.token_urlsafe(SESSION_TOKEN_BYTES)
        now = utc_now()
        web_session = WebSession(
            auth_user_id=user.id,
            token_hash=hash_session_token(token),
            user_agent=self.request.headers.get("user-agent", "")[:255] or None,
            last_ip=self.request.client.host if self.request.client else None,
            created_at=now,
            last_used_at=now,
            expires_at=now + self.idle_lifetime,
            absolute_expires_at=now + self.absolute_lifetime,
        )
        self.db.add(web_session)
        await self.db.flush()
        return token

    async def destroy_token(self, token: str, user: User) -> None:
        web_session = await self._get_session(token)
        if web_session is None or web_session.auth_user_id != user.id:
            return

        web_session.revoked_at = utc_now()
        await self.db.flush()

    async def refresh_token(self, token: str) -> int | None:
        web_session = await self._get_active_session(token)
        if web_session is None:
            return None

        now = utc_now()
        web_session.last_used_at = now
        web_session.last_ip = self.request.client.host if self.request.client else None
        web_session.expires_at = min(now + self.idle_lifetime, web_session.absolute_expires_at)
        await self.db.flush()

        return max(0, int((web_session.expires_at - now).total_seconds()))
