"""Integracion HTTP + PostgreSQL de movimientos: filtros, PATCH, DELETE y gasto diario.

Necesita una base PostgreSQL desechable con las migraciones aplicadas. Solo corre con
RUN_DB_TESTS=1 y un DATABASE_URL cuyo nombre de base termine en "_test", para que nunca
toque una base real:

    createdb tracking_test
    DATABASE_URL=postgresql+asyncpg://user:pass@127.0.0.1:5432/tracking_test \\
        alembic -c app/alembic.ini upgrade head
    RUN_DB_TESTS=1 DATABASE_URL=... SECRET_JWT=test pytest tests/test_finanzas_movimientos_db.py
"""
import os
import uuid
from datetime import datetime

import pytest

DB_URL = os.environ.get("DATABASE_URL", "")
RUN = os.environ.get("RUN_DB_TESTS") == "1" and DB_URL.rsplit("/", 1)[-1].endswith("_test")
pytestmark = [
    pytest.mark.skipif(not RUN, reason="Requiere RUN_DB_TESTS=1 y una base *_test (ver docstring)."),
    # El engine de app.db se comparte: fixtures y tests en el mismo loop (el de sesion).
    pytest.mark.asyncio(loop_scope="session"),
]

if RUN:
    import httpx
    from sqlalchemy import delete

    from app.auth.fastapi_users import current_user_or_api_key
    from app.db.session import AsyncSessionLocal, engine
    from app.main import app
    from app.models import Banco, CategoriaFinanza, CuentaUsuario, Movimiento, ProductoFinanciero, Usuario
    from app.models.finanzas import EnumTipoGasto, EnumTipoMovimiento
    from app.models.usuario_auth import User


@pytest.fixture
async def escenario():
    """Usuario con dos cuentas, dos categorias y movimientos en septiembre y agosto."""
    sufijo = uuid.uuid4().hex[:8]
    async with AsyncSessionLocal() as db:
        auth = User(email=f"test-{sufijo}@example.com", hashed_password="x", is_active=True)
        db.add(auth)
        await db.flush()
        usuario = Usuario(
            username=f"t{sufijo}", nombre="Test", apellido="Movs", telefono=sufijo[:8],
            email=auth.email, auth_user_id=auth.id,
        )
        banco = Banco(nombre_banco=f"Banco {sufijo}")
        db.add_all([usuario, banco])
        await db.flush()
        producto = ProductoFinanciero(id_banco=banco.id_banco, nombre_producto="Cuenta Vista")
        comida = CategoriaFinanza(nombre=f"comida-{sufijo}")
        salud = CategoriaFinanza(nombre=f"salud-{sufijo}")
        db.add_all([producto, comida, salud])
        await db.flush()
        rut = CuentaUsuario(id_usuario=usuario.id_usuario, id_producto_financiero=producto.id_producto_financiero, nombre_cuenta="RUT")
        tc = CuentaUsuario(id_usuario=usuario.id_usuario, id_producto_financiero=producto.id_producto_financiero, nombre_cuenta="TC")
        db.add_all([rut, tc])
        await db.flush()

        def mov(cuenta, categoria, monto, fecha, tipo=EnumTipoMovimiento.GASTO, descripcion=None):
            return Movimiento(
                id_cuenta=cuenta.id_cuenta, id_categoria=categoria.id_categoria, tipo_movimiento=tipo,
                tipo_gasto=EnumTipoGasto.VARIABLE, monto=monto, created_at=fecha, descripcion=descripcion,
                en_lugar_compra=False,
            )

        movimientos = [
            mov(rut, comida, 8500, datetime(2026, 9, 25, 13, 0), descripcion="Almuerzo"),
            mov(tc, salud, 18990, datetime(2026, 9, 22, 19, 0), descripcion="Farmacia del barrio"),
            mov(rut, comida, 850000, datetime(2026, 9, 1, 9, 0), tipo=EnumTipoMovimiento.INGRESO),
            mov(rut, comida, 4000, datetime(2026, 8, 30, 20, 0)),
        ]
        db.add_all(movimientos)
        await db.commit()
        ids = {
            "usuario": usuario, "auth": auth, "comida": comida.id_categoria, "salud": salud.id_categoria,
            "rut": rut.id_cuenta, "tc": tc.id_cuenta, "movs": [m.id_transaccion for m in movimientos],
        }

    app.dependency_overrides[current_user_or_api_key] = lambda: ids["auth"]
    yield ids
    app.dependency_overrides.clear()

    async with AsyncSessionLocal() as db:
        await db.execute(delete(Movimiento).where(Movimiento.id_cuenta.in_([ids["rut"], ids["tc"]])))
        await db.execute(delete(CuentaUsuario).where(CuentaUsuario.id_cuenta.in_([ids["rut"], ids["tc"]])))
        await db.execute(delete(CategoriaFinanza).where(CategoriaFinanza.id_categoria.in_([ids["comida"], ids["salud"]])))
        await db.execute(delete(Usuario).where(Usuario.id_usuario == ids["usuario"].id_usuario))
        await db.execute(delete(User).where(User.id == ids["auth"].id))
        await db.commit()
    await engine.dispose()


def cliente():
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")


async def test_listado_filtra_por_mes_tipo_categoria_cuenta_y_texto(escenario):
    async with cliente() as c:
        base = "/api/finanzas/movimientos/"
        septiembre = (await c.get(base, params={"year": 2026, "month": 9})).json()["items"]
        gastos_sep = (await c.get(base, params={"year": 2026, "month": 9, "tipo_movimiento": "gasto"})).json()["items"]
        salud = (await c.get(base, params={"id_categoria": escenario["salud"]})).json()["items"]
        tc = (await c.get(base, params={"id_cuenta": escenario["tc"]})).json()["items"]
        farmacia = (await c.get(base, params={"q": "farmacia"})).json()["items"]
        vacio = await c.get(base, params={"year": 2025, "month": 1})

    assert len(septiembre) == 3
    assert [m["monto"] for m in gastos_sep] == [8500, 18990]
    assert [m["monto"] for m in salud] == [18990]
    assert [m["monto"] for m in tc] == [18990]
    assert [m["descripcion"] for m in farmacia] == ["Farmacia del barrio"]
    # Sin resultados: lista vacia, no 404.
    assert vacio.status_code == 200
    assert vacio.json()["items"] == []


async def test_patch_edita_nota_y_fecha(escenario):
    id_mov = escenario["movs"][0]
    async with cliente() as c:
        r = await c.patch(
            f"/api/finanzas/movimientos/{id_mov}",
            json={"descripcion": "Almuerzo con equipo", "created_at": "2026-09-24T13:30:00", "monto": 9000},
        )
        sin_nota = await c.patch(f"/api/finanzas/movimientos/{id_mov}", json={"descripcion": None})
        monto_negativo = await c.patch(f"/api/finanzas/movimientos/{id_mov}", json={"monto": -1})

    assert r.status_code == 200, r.text
    assert r.json()["descripcion"] == "Almuerzo con equipo"
    assert r.json()["created_at"].startswith("2026-09-24T13:30")
    assert r.json()["monto"] == 9000
    assert sin_nota.json()["descripcion"] is None
    assert monto_negativo.status_code == 422


async def test_delete_borra_solo_movimientos_propios(escenario):
    id_mov = escenario["movs"][1]
    async with cliente() as c:
        borrado = await c.delete(f"/api/finanzas/movimientos/{id_mov}")
        otra_vez = await c.delete(f"/api/finanzas/movimientos/{id_mov}")
        detalle = await c.get(f"/api/finanzas/movimientos/{id_mov}")
        inexistente = await c.delete("/api/finanzas/movimientos/999999999")

    assert borrado.status_code == 204
    assert otra_vez.status_code == 404
    assert detalle.status_code == 404
    assert inexistente.status_code == 404


async def test_analitica_diaria_suma_por_dia(escenario):
    async with cliente() as c:
        r = await c.get("/api/finanzas/analitica/diaria", params={"year": 2026, "month": 9})

    data = r.json()
    assert r.status_code == 200, r.text
    assert data["dias_mes"] == 30
    dia_25 = next(item for item in data["items"] if item["dia"] == 25)
    dia_1 = next(item for item in data["items"] if item["dia"] == 1)
    assert dia_25["gasto_total"] == 8500
    assert dia_1["ingreso_total"] == 850000
    assert data["gasto_total"] == 8500 + 18990
    assert data["dia_mayor_gasto"]["dia"] == 22
