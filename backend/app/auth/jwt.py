from fastapi_users.authentication import JWTStrategy
from app.settings import SECRET


def get_jwt_strategy() -> JWTStrategy:
    return JWTStrategy(
        secret=SECRET,
        lifetime_seconds=60 * 60 * 24,
        token_audience="fastapi-users",
    )
