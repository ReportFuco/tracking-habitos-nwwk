from collections.abc import Iterable
from urllib.parse import quote

from fastapi import FastAPI, Form, Request, status
from fastapi.openapi.docs import get_redoc_html, get_swagger_ui_html
from fastapi.openapi.utils import get_openapi
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.routing import APIRoute
from sqlalchemy import select

from app import settings
from app.db.session import AsyncSessionLocal
from app.models import User, Usuario
from app.auth.manager import UserManager
from app.auth.dependencies import get_user_db


DOC_MODULES = [
    {
        "slug": "auth",
        "title": "Auth",
        "description": "Autenticacion y registro de usuarios.",
        "prefixes": ("/auth",),
    },
    {
        "slug": "usuarios",
        "title": "Usuarios",
        "description": "Perfil y administracion de usuarios.",
        "prefixes": ("/api/usuarios",),
    },
    {
        "slug": "finanzas",
        "title": "Finanzas",
        "description": "Bancos, cuentas, categorias y movimientos.",
        "prefixes": ("/api/finanzas",),
    },
    {
        "slug": "compras",
        "title": "Compras",
        "description": "Compras, detalles, locales y vinculos con movimientos.",
        "prefixes": ("/api/compras",),
    },
    {
        "slug": "catalogo",
        "title": "Catalogo",
        "description": "Productos, marcas, categorias y subcategorias.",
        "prefixes": ("/api/catalogo",),
    },
    {
        "slug": "nutricion",
        "title": "Nutricion",
        "description": "Consumos, metas, peso y tablas nutricionales.",
        "prefixes": ("/api/nutricion",),
    },
    {
        "slug": "entrenamientos",
        "title": "Entrenamientos",
        "description": "Ejercicios, gimnasio, fuerza y series.",
        "prefixes": ("/api/entrenamientos",),
    },
    {
        "slug": "lecturas",
        "title": "Lecturas",
        "description": "Libros y registros de lectura.",
        "prefixes": ("/api/lecturas",),
    },
]


OPENAPI_TAGS = [
    {"name": "Auth", "description": "Autenticacion y registro."},
    {"name": "Usuario", "description": "Perfil y administracion de usuarios."},
    {"name": "Finanzas", "description": "Operaciones del dominio de finanzas."},
    {"name": "Compras", "description": "Operaciones del dominio de compras."},
    {"name": "Catalogo", "description": "Operaciones del dominio de catalogo."},
    {"name": "Nutricion", "description": "Operaciones del dominio de nutricion."},
    {"name": "Entrenamientos", "description": "Operaciones del dominio de entrenamientos."},
    {"name": "Lecturas", "description": "Operaciones del dominio de lecturas."},
]


DOCS_SESSION_KEY = "docs_user"
DOCS_LOGIN_PATH = "/docs/login"
DOCS_LOGOUT_PATH = "/docs/logout"


def install_docs(app: FastAPI) -> None:
    app.state.module_openapi_cache = {}

    @app.get("/", include_in_schema=False)
    async def docs_root_redirect(request: Request):
        return await _redirect_or_docs_menu(request)

    @app.get(DOCS_LOGIN_PATH, include_in_schema=False)
    async def docs_login_page(request: Request, next: str = "/docs"):
        if _is_docs_authenticated(request):
            return RedirectResponse(url=next or "/docs", status_code=303)
        return HTMLResponse(_build_docs_login_html(next=next, error=None), status_code=200)

    @app.post(DOCS_LOGIN_PATH, include_in_schema=False)
    async def docs_login_submit(
        request: Request,
        username: str = Form(...),
        password: str = Form(...),
        next: str = Form("/docs"),
    ):
        user = await _authenticate_docs_user(username=username, password=password)
        if user is None:
            return HTMLResponse(
                _build_docs_login_html(next=next, error="Credenciales inválidas o usuario inactivo."),
                status_code=401,
            )

        request.session[DOCS_SESSION_KEY] = {
            "user_id": user.id,
            "email": user.email,
            "is_superuser": bool(user.is_superuser),
        }
        return RedirectResponse(url=next or "/docs", status_code=303)

    @app.get(DOCS_LOGOUT_PATH, include_in_schema=False)
    async def docs_logout(request: Request):
        request.session.pop(DOCS_SESSION_KEY, None)
        return RedirectResponse(url=f"{DOCS_LOGIN_PATH}?next=%2Fdocs", status_code=303)

    @app.get("/docs", include_in_schema=False)
    async def docs_menu(request: Request):
        guard = _require_docs_auth(request)
        if guard is not None:
            return guard
        return HTMLResponse(_build_docs_menu_html(request))

    @app.get("/docs/global", include_in_schema=False)
    async def docs_global(request: Request):
        guard = _require_docs_auth(request)
        if guard is not None:
            return guard
        return _swagger_with_nav(
            openapi_url="/openapi.json",
            title=f"{settings.TITLE_API} - Documentacion Global",
        )

    @app.get("/openapi.json", include_in_schema=False)
    async def openapi_global(request: Request):
        guard = _require_docs_auth(request)
        if guard is not None:
            return guard
        return app.openapi()

    @app.get("/redoc", include_in_schema=False)
    async def docs_redoc(request: Request):
        guard = _require_docs_auth(request)
        if guard is not None:
            return guard
        return _redoc_with_nav(
            openapi_url="/openapi.json",
            title=f"{settings.TITLE_API} - ReDoc",
        )

    for module in DOC_MODULES:
        _register_module_docs(app, module)


def use_custom_openapi(app: FastAPI) -> None:
    def custom_openapi():
        if app.openapi_schema:
            return app.openapi_schema

        app.openapi_schema = get_openapi(
            title=settings.TITLE_API,
            version=settings.VERSION_API,
            description=(
                "API encargada de realizar registros a areas como finanzas, "
                "deportes, habitos, compras y mas."
            ),
            routes=app.routes,
            tags=OPENAPI_TAGS,
        )
        return app.openapi_schema

    app.openapi = custom_openapi


def _register_module_docs(app: FastAPI, module: dict[str, object]) -> None:
    slug = str(module["slug"])
    title = str(module["title"])

    @app.get(f"/docs/{slug}", include_in_schema=False, name=f"docs_{slug}")
    async def module_docs(request: Request, slug: str = slug, title: str = title):
        guard = _require_docs_auth(request)
        if guard is not None:
            return guard
        return _swagger_with_nav(
            openapi_url=f"/openapi/{slug}.json",
            title=f"{settings.TITLE_API} - {title}",
        )

    @app.get(f"/openapi/{slug}.json", include_in_schema=False, name=f"openapi_{slug}")
    async def module_openapi(request: Request, slug: str = slug):
        guard = _require_docs_auth(request)
        if guard is not None:
            return guard
        return get_module_openapi(app, slug)


def get_module_openapi(app: FastAPI, slug: str) -> dict:
    cache = app.state.module_openapi_cache
    if slug in cache:
        return cache[slug]

    module = next((item for item in DOC_MODULES if item["slug"] == slug), None)
    if not module:
        raise ValueError(f"Modulo de documentacion no encontrado: {slug}")

    routes = _filter_routes_by_prefixes(app.routes, module["prefixes"])
    schema = get_openapi(
        title=f"{settings.TITLE_API} - {module['title']}",
        version=settings.VERSION_API,
        description=str(module["description"]),
        routes=routes,
    )
    cache[slug] = schema
    return schema


def _filter_routes_by_prefixes(routes: Iterable, prefixes: tuple[str, ...]) -> list[APIRoute]:
    return [
        route
        for route in routes
        if isinstance(route, APIRoute)
        and route.include_in_schema
        and any(route.path.startswith(prefix) for prefix in prefixes)
    ]


def _is_docs_authenticated(request: Request) -> bool:
    session_user = request.session.get(DOCS_SESSION_KEY)
    return bool(
        session_user
        and session_user.get("user_id")
        and session_user.get("is_superuser") is True
    )


def _require_docs_auth(request: Request):
    if _is_docs_authenticated(request):
        return None
    next_url = quote(request.url.path or "/docs", safe="/")
    if request.url.query:
        next_url = quote(f"{request.url.path}?{request.url.query}", safe="/?=&")
    return RedirectResponse(url=f"{DOCS_LOGIN_PATH}?next={next_url}", status_code=status.HTTP_303_SEE_OTHER)


async def _redirect_or_docs_menu(request: Request):
    if _is_docs_authenticated(request):
        return RedirectResponse(url="/docs", status_code=307)
    return RedirectResponse(url=f"{DOCS_LOGIN_PATH}?next=%2Fdocs", status_code=303)


async def _authenticate_docs_user(username: str, password: str) -> User | None:
    async with AsyncSessionLocal() as session:
        async for user_db in get_user_db(session):
            manager = UserManager(user_db, session)
            login_value = username.strip()

            user = await user_db.get_by_email(login_value)
            if user is None:
                user = await session.scalar(
                    select(User)
                    .join(Usuario, Usuario.auth_user_id == User.id)
                    .where(Usuario.username == login_value)
                )

            if user is None:
                manager.password_helper.hash(password)
                return None

            verified, updated_password_hash = manager.password_helper.verify_and_update(
                password,
                user.hashed_password,
            )
            if not verified:
                return None

            if updated_password_hash is not None:
                await user_db.update(user, {"hashed_password": updated_password_hash})
                await session.commit()

            if not user.is_active:
                return None

            return user
    return None


def _build_docs_login_html(next: str, error: str | None) -> str:
    error_html = f'<div class="error">{error}</div>' if error else ""
    return f"""
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{settings.TITLE_API} - Login Docs</title>
        <style>
            body {{ font-family: 'Segoe UI', sans-serif; background: #f4efe6; margin: 0; color: #1f2937; }}
            .wrap {{ min-height: 100vh; display: grid; place-items: center; padding: 24px; }}
            .card {{ width: 100%; max-width: 420px; background: #fffdf8; border-radius: 18px; padding: 28px; box-shadow: 0 18px 45px rgba(31,41,55,.12); }}
            h1 {{ margin: 0 0 8px; font-size: 1.8rem; }}
            p {{ color: #5b6470; line-height: 1.5; }}
            label {{ display:block; margin: 16px 0 6px; font-weight: 600; }}
            input {{ width: 100%; padding: 12px 14px; border-radius: 12px; border: 1px solid #d7dce2; font-size: 16px; box-sizing: border-box; }}
            button {{ margin-top: 18px; width: 100%; padding: 12px 16px; border: 0; border-radius: 12px; background: #0f766e; color: white; font-weight: 700; font-size: 16px; cursor: pointer; }}
            .hint {{ margin-top: 14px; font-size: 14px; color: #6b7280; }}
            .error {{ margin-top: 14px; background: #fff1f2; color: #b42318; border: 1px solid #fecdd3; padding: 10px 12px; border-radius: 12px; }}
        </style>
    </head>
    <body>
        <div class="wrap">
            <form class="card" method="post" action="{DOCS_LOGIN_PATH}">
                <h1>Login Docs</h1>
                <p>Ingresa con tu usuario real de la API. Puedes usar tu email o username.</p>
                <input type="hidden" name="next" value="{next}" />
                <label for="username">Email o username</label>
                <input id="username" name="username" type="text" autocomplete="username" required />
                <label for="password">Contraseña</label>
                <input id="password" name="password" type="password" autocomplete="current-password" required />
                <button type="submit">Entrar a la documentación</button>
                {error_html}
                <div class="hint">Al entrar se crea una sesión segura solo para acceder a la documentación.</div>
            </form>
        </div>
    </body>
    </html>
    """


def _build_docs_menu_html(request: Request) -> str:
    user = request.session.get(DOCS_SESSION_KEY, {})
    cards = "\n".join(
        (
            f"""
            <a class="card" href="/docs/{module['slug']}">
                <span class="eyebrow">Modulo</span>
                <h2>{module['title']}</h2>
                <p>{module['description']}</p>
            </a>
            """
        ).strip()
        for module in DOC_MODULES
    )

    return f"""
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{settings.TITLE_API} - Documentacion</title>
        <style>
            :root {{ --bg: #f4efe6; --panel: rgba(255, 252, 246, 0.9); --ink: #1f2937; --muted: #5b6470; --line: rgba(31, 41, 55, 0.12); --accent: #0f766e; --accent-2: #d97706; --shadow: 0 18px 45px rgba(31, 41, 55, 0.12); }}
            * {{ box-sizing: border-box; }}
            body {{ margin: 0; font-family: "Segoe UI", sans-serif; color: var(--ink); background: radial-gradient(circle at top left, rgba(15, 118, 110, 0.18), transparent 32%), radial-gradient(circle at top right, rgba(217, 119, 6, 0.16), transparent 26%), linear-gradient(180deg, #fcfaf6 0%, var(--bg) 100%); min-height: 100vh; }}
            .shell {{ max-width: 1120px; margin: 0 auto; padding: 48px 24px 64px; }}
            .hero {{ display: grid; gap: 20px; margin-bottom: 32px; }}
            .badge {{ width: fit-content; padding: 8px 14px; border-radius: 999px; background: rgba(15, 118, 110, 0.1); color: var(--accent); font-size: 14px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }}
            h1 {{ margin: 0; font-size: clamp(2.2rem, 5vw, 4.2rem); line-height: 1; max-width: 10ch; }}
            .lead {{ margin: 0; max-width: 62ch; color: var(--muted); font-size: 1.05rem; line-height: 1.7; }}
            .actions {{ display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }}
            .button {{ display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 18px; border-radius: 999px; text-decoration: none; font-weight: 700; transition: transform .18s ease, box-shadow .18s ease, background .18s ease; }}
            .button.primary {{ background: var(--accent); color: white; box-shadow: 0 10px 30px rgba(15, 118, 110, 0.25); }}
            .button.secondary {{ background: rgba(255,255,255,0.75); color: var(--ink); border: 1px solid var(--line); }}
            .button:hover {{ transform: translateY(-1px); }}
            .userbox {{ padding: 10px 14px; border-radius: 999px; background: rgba(255,255,255,0.75); border: 1px solid var(--line); color: var(--muted); font-size: 14px; }}
            .grid {{ display:grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 18px; }}
            .card {{ display:block; text-decoration:none; color:inherit; background: var(--panel); border: 1px solid var(--line); border-radius: 24px; padding: 24px; box-shadow: var(--shadow); backdrop-filter: blur(10px); }}
            .card:hover {{ border-color: rgba(15, 118, 110, 0.28); transform: translateY(-2px); }}
            .eyebrow {{ color: var(--accent-2); font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }}
        </style>
    </head>
    <body>
        <main class="shell">
            <section class="hero">
                <span class="badge">Documentación protegida</span>
                <h1>{settings.TITLE_API}</h1>
                <p class="lead">Acceso restringido para usuarios autenticados. Aquí puedes entrar a la documentación global o por módulo.</p>
                <div class="actions">
                    <a class="button primary" href="/docs/global">Ver docs global</a>
                    <a class="button secondary" href="/redoc">ReDoc</a>
                    <a class="button secondary" href="{DOCS_LOGOUT_PATH}">Cerrar sesión</a>
                    <span class="userbox">Sesión: {user.get('email', 'usuario')}</span>
                </div>
            </section>
            <section class="grid">
                {cards}
            </section>
        </main>
    </body>
    </html>
    """


def _swagger_with_nav(openapi_url: str, title: str):
    return get_swagger_ui_html(openapi_url=openapi_url, title=title)


def _redoc_with_nav(openapi_url: str, title: str):
    return get_redoc_html(openapi_url=openapi_url, title=title)
