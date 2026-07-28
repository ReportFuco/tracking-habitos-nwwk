from fastapi import Request
from loguru import logger
import time

_LAST_LOGGED_REQUESTS: dict[tuple[str, str, str, int], float] = {}
_REPEATED_GET_LOG_WINDOW_SECONDS = 10.0


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
