from fastapi_users.authentication import JWTStrategy
from app.settings import ACCESS_TOKEN_MINUTES, SECRET


def get_jwt_strategy() -> JWTStrategy:
    return JWTStrategy(
        secret=SECRET,
        lifetime_seconds=60 * ACCESS_TOKEN_MINUTES,
        token_audience="fastapi-users",
    )
