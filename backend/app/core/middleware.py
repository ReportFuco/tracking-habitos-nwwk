from fastapi import Request, status
from fastapi.responses import JSONResponse
from loguru import logger
import time

from app.settings import CORS_ORIGINS, SESSION_COOKIE_NAME, URL_SITE

_LAST_LOGGED_REQUESTS: dict[tuple[str, str, str, int], float] = {}
_REPEATED_GET_LOG_WINDOW_SECONDS = 10.0
_SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}


async def cookie_csrf_middleware(request: Request, call_next):
    if (
        request.method not in _SAFE_METHODS
        and SESSION_COOKIE_NAME in request.cookies
    ):
        origin = request.headers.get("origin")
        allowed_origins = {item.rstrip("/") for item in CORS_ORIGINS}
        if URL_SITE:
            allowed_origins.add(URL_SITE.rstrip("/"))

        if origin and origin.rstrip("/") not in allowed_origins:
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "Origen no permitido para una sesión web."},
            )

    return await call_next(request)


async def logging_middleware(request: Request, call_next):
    start_time = time.time()

    response = await call_next(request)

    duration = time.time() - start_time

    client_ip = request.client.host if request.client else "unknown"
    log_key = (client_ip, request.method, request.url.path, response.status_code)
    now = time.monotonic()

    # Evita inundar la consola con GET exitosos idénticos disparados por polling.
    if request.method == "GET" and response.status_code < 400:
        last_logged_at = _LAST_LOGGED_REQUESTS.get(log_key)
        if (
            last_logged_at is not None
            and now - last_logged_at < _REPEATED_GET_LOG_WINDOW_SECONDS
        ):
            return response
        _LAST_LOGGED_REQUESTS[log_key] = now

    logger.bind(
        ip=client_ip,
        method=request.method,
        path=request.url.path,
        status=response.status_code,
        duration=f"{duration:.2f}s"
    ).info("request")

    return response
