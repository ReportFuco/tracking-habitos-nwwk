"""Permisos (scopes) de las API keys en la API REST y al crearlas.

Los tests de reglas corren siempre; los de integracion necesitan RUN_DB_TESTS=1 y una
base *_test, como test_finanzas_movimientos_db.py.
"""
import os
import uuid

import httpx
import pytest
from pydantic import ValidationError

from app.auth.schemas import ApiKeyCreate
from app.auth.scopes import scope_requerido, tiene_scope
from app.main import app

DB_URL = os.environ.get("DATABASE_URL", "")
RUN_DB = os.environ.get("RUN_DB_TESTS") == "1" and DB_URL.rsplit("/", 1)[-1].endswith("_test")
requiere_db = pytest.mark.skipif(not RUN_DB, reason="Requiere RUN_DB_TESTS=1 y una base *_test.")


@pytest.mark.parametrize(
    ("metodo", "path", "esperado"),
    [
        ("GET", "/api/finanzas/movimientos/", "finanzas:read"),
        ("POST", "/api/finanzas/movimientos/", "finanzas:write"),
        ("DELETE", "/api/finanzas/movimientos/7", "finanzas:write"),
        ("GET", "/api/usuarios/perfil", "*"),
        # Un prefijo parecido no cuenta como finanzas.
        ("GET", "/api/finanzasx/", "*"),
    ],
)
def test_scope_requerido_por_ruta(metodo, path, esperado):
    assert scope_requerido(metodo, path) == esperado


def test_escritura_incluye_lectura_y_total_incluye_todo():
    assert tiene_scope(["finanzas:write"], "finanzas:read")
    assert not tiene_scope(["finanzas:read"], "finanzas:write")
    assert not tiene_scope(["finanzas:write"], "*")
    assert tiene_scope(["*"], "finanzas:write")
    assert not tiene_scope([], "finanzas:read")


def test_crear_key_por_defecto_es_solo_lectura_y_valida_scopes():
    assert ApiKeyCreate(nombre="Claude").scopes == ["finanzas:read"]
    assert ApiKeyCreate(nombre="x", scopes=["finanzas:write", "finanzas:write"]).scopes == ["finanzas:write"]
    with pytest.raises(ValidationError):
        ApiKeyCreate(nombre="x", scopes=["admin"])
    with pytest.raises(ValidationError):
        ApiKeyCreate(nombre="x", scopes=[])


if RUN_DB:
    from sqlalchemy import delete

    from app.auth.api_key import generate_api_key
    from app.auth.fastapi_users import current_user
    from app.db.session import AsyncSessionLocal, engine
    from app.models import ApiKey, Usuario
    from app.models.usuario_auth import User


@pytest.fixture
async def usuario_con_keys():
    sufijo = uuid.uuid4().hex[:8]
    async with AsyncSessionLocal() as db:
        auth = User(email=f"scopes-{sufijo}@example.com", hashed_password="x", is_active=True)
        db.add(auth)
        await db.flush()
        perfil = Usuario(
            username=f"sc{sufijo}", nombre="S", apellido="Scopes", telefono=f"3{sufijo[:7]}",
            email=auth.email, auth_user_id=auth.id,
        )
        db.add(perfil)
        keys = {}
        for nombre, scopes in (("lectura", ["finanzas:read"]), ("escritura", ["finanzas:write"]), ("total", ["*"])):
            valor, prefijo, key_hash = generate_api_key()
            db.add(ApiKey(auth_user_id=auth.id, nombre=nombre, key_prefix=prefijo, key_hash=key_hash, scopes=scopes))
            keys[nombre] = valor
        await db.commit()
        datos = {"auth": auth, "id_usuario": perfil.id_usuario, **keys}

    yield datos

    app.dependency_overrides.clear()
    async with AsyncSessionLocal() as db:
        await db.execute(delete(ApiKey).where(ApiKey.auth_user_id == datos["auth"].id))
        await db.execute(delete(Usuario).where(Usuario.id_usuario == datos["id_usuario"]))
        await db.execute(delete(User).where(User.id == datos["auth"].id))
        await db.commit()
    await engine.dispose()


def cliente():
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")


@requiere_db
@pytest.mark.asyncio(loop_scope="session")
async def test_rest_respeta_los_scopes_de_la_key(usuario_con_keys):
    def h(nombre):
        return {"X-API-Key": usuario_con_keys[nombre]}

    # Un POST con cuerpo invalido: si pasa la auth responde 422, si no 403.
    async with cliente() as c:
        lectura_get = await c.get("/api/finanzas/movimientos/", headers=h("lectura"))
        lectura_post = await c.post("/api/finanzas/movimientos/", headers=h("lectura"), json={})
        escritura_post = await c.post("/api/finanzas/movimientos/", headers=h("escritura"), json={})
        finanzas_en_perfil = await c.get("/api/usuarios/perfil", headers=h("escritura"))
        total_en_perfil = await c.get("/api/usuarios/perfil", headers=h("total"))

    assert lectura_get.status_code == 200
    assert lectura_post.status_code == 403
    assert lectura_post.json()["detail"] == "La API key no tiene el permiso finanzas:write."
    assert escritura_post.status_code == 422
    assert finanzas_en_perfil.status_code == 403
    assert total_en_perfil.status_code == 200


@requiere_db
@pytest.mark.asyncio(loop_scope="session")
async def test_crear_y_listar_keys_con_scopes(usuario_con_keys):
    app.dependency_overrides[current_user] = lambda: usuario_con_keys["auth"]
    async with cliente() as c:
        por_defecto = await c.post("/auth/api-keys", json={"nombre": "Claude"})
        escritura = await c.post("/auth/api-keys", json={"nombre": "Agente", "scopes": ["finanzas:write"]})
        invalida = await c.post("/auth/api-keys", json={"nombre": "x", "scopes": ["admin"]})
        listado = await c.get("/auth/api-keys")

    assert por_defecto.status_code == 201
    assert por_defecto.json()["scopes"] == ["finanzas:read"]
    assert por_defecto.json()["api_key"].startswith("thw_")
    assert escritura.json()["scopes"] == ["finanzas:write"]
    assert invalida.status_code == 422
    assert {k["nombre"]: k["scopes"] for k in listado.json()}["total"] == ["*"]
