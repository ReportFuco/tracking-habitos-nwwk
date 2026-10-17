"""Saldo de las cuentas en la API REST: declararlo al crear o después, y que los
movimientos lo muevan.

Integración HTTP + PostgreSQL con API key, como test_rest_deudas.py: solo corre con
RUN_DB_TESTS=1 y un DATABASE_URL cuya base termine en "_test".
"""
import os
import uuid

import httpx
import pytest

from app.main import app

DB_URL = os.environ.get("DATABASE_URL", "")
RUN_DB = os.environ.get("RUN_DB_TESTS") == "1" and DB_URL.rsplit("/", 1)[-1].endswith("_test")
pytestmark = [
    pytest.mark.asyncio(loop_scope="session"),
    pytest.mark.skipif(not RUN_DB, reason="Requiere RUN_DB_TESTS=1 y una base *_test."),
]

if RUN_DB:
    from sqlalchemy import delete

    from app.auth.api_key import generate_api_key
    from app.db.session import AsyncSessionLocal
    from app.models import ApiKey, Banco, CategoriaFinanza, CuentaUsuario, Movimiento, ProductoFinanciero, Usuario
    from app.models.usuario_auth import User


@pytest.fixture
async def usuario():
    sufijo = uuid.uuid4().hex[:8]
    async with AsyncSessionLocal() as db:
        auth = User(email=f"saldo_{sufijo}@mail.com", hashed_password="x", is_active=True, is_verified=True)
        db.add(auth)
        await db.flush()
        perfil = Usuario(
            username=f"sal{sufijo}", nombre="S", apellido="Aldo", telefono=f"5{sufijo[:7]}",
            email=auth.email, auth_user_id=auth.id,
        )
        banco = Banco(nombre_banco=f"Banco saldo {sufijo}")
        db.add_all([perfil, banco])
        await db.flush()
        producto_fin = ProductoFinanciero(id_banco=banco.id_banco, nombre_producto="Cuenta Vista")
        categoria = CategoriaFinanza(nombre=f"varios-{sufijo}", id_usuario=perfil.id_usuario)
        db.add_all([producto_fin, categoria])
        valor, prefijo, key_hash = generate_api_key()
        db.add(ApiKey(auth_user_id=auth.id, nombre="rest", key_prefix=prefijo, key_hash=key_hash, scopes=["*"], activo=True))
        await db.commit()
        datos = {
            "headers": {"X-API-Key": valor},
            "categoria": categoria.id_categoria,
            "perfil": perfil.id_usuario,
            "auth": auth.id,
            "banco": banco.id_banco,
            "producto_fin": producto_fin.id_producto_financiero,
        }

    yield datos

    async with AsyncSessionLocal() as db:
        cuentas = CuentaUsuario.id_usuario == datos["perfil"]
        ids = [c.id_cuenta for c in (await db.execute(CuentaUsuario.__table__.select().where(cuentas))).all()]
        await db.execute(delete(Movimiento).where(Movimiento.id_cuenta.in_(ids)))
        await db.execute(delete(CuentaUsuario).where(cuentas))
        await db.execute(delete(ProductoFinanciero).where(ProductoFinanciero.id_producto_financiero == datos["producto_fin"]))
        await db.execute(delete(Banco).where(Banco.id_banco == datos["banco"]))
        await db.execute(delete(ApiKey).where(ApiKey.auth_user_id == datos["auth"]))
        await db.execute(delete(Usuario).where(Usuario.id_usuario == datos["perfil"]))
        await db.execute(delete(User).where(User.id == datos["auth"]))
        await db.commit()


async def test_saldo_se_declara_y_lo_mueven_los_movimientos(usuario):
    headers = usuario["headers"]
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test", headers=headers) as c:
        creada = await c.post("/api/finanzas/cuentas/", json={
            "id_producto_financiero": usuario["producto_fin"], "nombre_cuenta": "Debito", "saldo_actual": 100000,
        })
        sin_saldo = await c.post("/api/finanzas/cuentas/", json={
            "id_producto_financiero": usuario["producto_fin"], "nombre_cuenta": "Efectivo",
        })
        id_cuenta = creada.json()["id_cuenta"]
        gasto = await c.post("/api/finanzas/movimientos/", json={
            "id_cuenta": id_cuenta, "id_categoria": usuario["categoria"], "tipo_movimiento": "gasto",
            "tipo_gasto": "variable", "monto": 5000,
        })
        tras_gasto = {cuenta["id_cuenta"]: cuenta for cuenta in (await c.get("/api/finanzas/cuentas/")).json()}
        ajustada = await c.post(f"/api/finanzas/cuentas/{id_cuenta}/saldo", json={"saldo": 80000})
        otro_gasto = await c.post("/api/finanzas/movimientos/", json={
            "id_cuenta": id_cuenta, "id_categoria": usuario["categoria"], "tipo_movimiento": "gasto",
            "tipo_gasto": "variable", "monto": 1000,
        })
        final = {cuenta["id_cuenta"]: cuenta["saldo_actual"] for cuenta in (await c.get("/api/finanzas/cuentas/")).json()}
        ajena = await c.post("/api/finanzas/cuentas/999999999/saldo", json={"saldo": 1})

    assert creada.status_code == 201, creada.text
    assert creada.json()["saldo_actual"] == 100000
    assert sin_saldo.json()["saldo_actual"] is None
    assert gasto.status_code == 201, gasto.text
    assert tras_gasto[id_cuenta]["saldo_actual"] == 95000
    # El gasto de hoy ya registrado no vuelve a descontarse del monto declarado.
    assert ajustada.status_code == 200, ajustada.text
    assert ajustada.json()["saldo_actual"] == 80000
    assert otro_gasto.status_code == 201
    assert final == {id_cuenta: 79000, sin_saldo.json()["id_cuenta"]: None}
    assert ajena.status_code == 404
