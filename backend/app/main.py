from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app import settings
from app.auth.routes import router as auth_router
from app.docs import OPENAPI_TAGS, install_docs, use_custom_openapi
from app.routes import router
from app.core.logging import setup_logging
from app.core.middleware import logging_middleware


setup_logging()

app = FastAPI(
    title=settings.TITLE_API,
    version=settings.VERSION_API,
    description="API encargada de realizar registros a áreas como finanzas, deportes, hábitos entre otros.",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    openapi_tags=OPENAPI_TAGS,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    SessionMiddleware,
    secret_key=settings.SECRET,
    same_site="lax",
    https_only=settings.URL_SITE.startswith("https://"),
    max_age=60 * 60 * 8,
)

# -------------------------
# Middleware
# -------------------------

app.middleware("http")(logging_middleware)

# -------------------------
# Routers
# -------------------------

app.include_router(router)
app.include_router(auth_router)
use_custom_openapi(app)
install_docs(app)


if __name__=="__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=True,
        access_log=False
    )
