from datetime import timedelta
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from starlette.requests import Request

from app.auth.session import WebSessionStrategy, hash_session_token, utc_now
from app.main import app
from app.settings import SESSION_COOKIE_NAME


class FakeDatabase:
    def __init__(self):
        self.web_session = None
        self.flush_count = 0

    def add(self, web_session):
        self.web_session = web_session

    async def flush(self):
        self.flush_count += 1

    async def scalar(self, _query):
        return self.web_session


class FakeUserManager:
    def __init__(self, user):
        self.user = user

    async def get(self, user_id):
        assert user_id == self.user.id
        return self.user


def make_request() -> Request:
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/auth/session/login",
            "headers": [(b"user-agent", b"pytest-pwa")],
            "client": ("127.0.0.1", 50000),
            "scheme": "https",
            "server": ("testserver", 443),
        }
    )


def test_session_endpoints_are_exposed():
    paths = app.openapi()["paths"]

    assert "/auth/session/login" in paths
    assert "/auth/session/logout" in paths
    assert "/auth/session/refresh" in paths


def test_cookie_session_rejects_unsafe_cross_origin_request():
    client = TestClient(app)
    client.cookies.set(SESSION_COOKIE_NAME, "opaque-token")

    response = client.post(
        "/auth/session/refresh",
        headers={"Origin": "https://attacker.invalid"},
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_session_token_is_opaque_hashed_and_revocable():
    db = FakeDatabase()
    strategy = WebSessionStrategy(db, make_request())
    user = SimpleNamespace(id=42, is_active=True)

    token = await strategy.write_token(user)

    assert token
    assert db.web_session.token_hash == hash_session_token(token)
    assert db.web_session.token_hash != token
    assert db.web_session.user_agent == "pytest-pwa"

    authenticated = await strategy.read_token(token, FakeUserManager(user))
    assert authenticated is user

    await strategy.destroy_token(token, user)
    assert db.web_session.revoked_at is not None
    assert await strategy.read_token(token, FakeUserManager(user)) is None


@pytest.mark.asyncio
async def test_refresh_extends_idle_expiry_without_crossing_absolute_limit():
    db = FakeDatabase()
    strategy = WebSessionStrategy(db, make_request())
    user = SimpleNamespace(id=7, is_active=True)
    token = await strategy.write_token(user)

    absolute_limit = utc_now() + timedelta(hours=2)
    db.web_session.expires_at = utc_now() + timedelta(minutes=5)
    db.web_session.absolute_expires_at = absolute_limit

    max_age = await strategy.refresh_token(token)

    assert max_age is not None
    assert 0 < max_age <= 2 * 60 * 60
    assert db.web_session.expires_at <= absolute_limit
