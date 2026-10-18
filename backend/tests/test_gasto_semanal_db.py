"""Integración PostgreSQL del gasto semanal: API REST de metas y alertas Push.

Solo corre con RUN_DB_TESTS=1 y una base *_test (ver test_finanzas_movimientos_db.py).
"""
import os
import uuid
from datetime import datetime, time, timedelta

import pytest

DB_URL = os.environ.get("DATABASE_URL", "")
RUN = os.environ.get("RUN_DB_TESTS") == "1" and DB_URL.rsplit("/", 1)[-1].endswith("_test")
pytestmark = [
    pytest.mark.skipif(not RUN, reason="Requiere RUN_DB_TESTS=1 y una base *_test."),
    pytest.mark.asyncio(loop_scope="session"),
]

if RUN:
    import httpx
    from sqlalchemy import delete, select

    from app.auth.fastapi_users import current_user_or_api_key
    from app.db.session import AsyncSessionLocal
    from app.main import app
    from app.models import (
        AlertaGasto,
        Banco,
        CategoriaFinanza,
        CuentaUsuario,
        Deuda,
        MetaGasto,
        Movimiento,
        NotificationPreference,
        ProductoFinanciero,
        PushSubscription,
        Usuario,
    )
    from app.models.finanzas import EnumTipoDeuda, EnumTipoGasto, EnumTipoMovimiento
    from app.models.usuario_auth import User
    from app.notifications import metas
    from app.services.finanzas.semanal import CHILE_TZ, hoy_chile, lunes_de


@pytest.fixture
async def escenario():
    """Usuario con una cuenta, comida, «Pago tarjeta de crédito» propia y una deuda."""
    sufijo = uuid.uuid4().hex[:8]
    async with AsyncSessionLocal() as db:
        auth = User(email=f"semana-{sufijo}@example.com", hashed_password="x", is_active=True)
        db.add(auth)
        await db.flush()
        usuario = Usuario(
            username=f"s{sufijo}", nombre="Test", apellido="Semana", telefono=sufijo[:8],
            email=auth.email, auth_user_id=auth.id,
        )
        banco = Banco(nombre_banco=f"Banco {sufijo}")
        db.add_all([usuario, banco])
        await db.flush()
        producto = ProductoFinanciero(id_banco=banco.id_banco, nombre_producto="Cuenta Vista")
        comida = CategoriaFinanza(nombre=f"comida-{sufijo}")
        tarjeta = CategoriaFinanza(nombre="Pago tarjeta de crédito", id_usuario=usuario.id_usuario)
        deuda = Deuda(
            id_usuario=usuario.id_usuario, tipo=EnumTipoDeuda.DEBO, nombre="Crédito", monto_total=500000
        )
        db.add_all([producto, comida, tarjeta, deuda])
        await db.flush()
        cuenta = CuentaUsuario(
            id_usuario=usuario.id_usuario,
            id_producto_financiero=producto.id_producto_financiero,
            nombre_cuenta="RUT",
        )
        db.add(cuenta)
        await db.commit()
        ids = {
            "auth": auth,
            "usuario": usuario.id_usuario,
            "cuenta": cuenta.id_cuenta,
            "comida": comida.id_categoria,
            "tarjeta": tarjeta.id_categoria,
            "deuda": deuda.id_deuda,
        }

    yield ids
    app.dependency_overrides.clear()

    async with AsyncSessionLocal() as db:
        await db.execute(delete(Movimiento).where(Movimiento.id_cuenta == ids["cuenta"]))
        await db.execute(delete(CuentaUsuario).where(CuentaUsuario.id_cuenta == ids["cuenta"]))
        await db.execute(delete(Deuda).where(Deuda.id_deuda == ids["deuda"]))
        await db.execute(delete(Usuario).where(Usuario.id_usuario == ids["usuario"]))
        # La categoría propia, metas, presupuestos y alertas caen por ON DELETE CASCADE.
        await db.execute(delete(CategoriaFinanza).where(CategoriaFinanza.id_categoria == ids["comida"]))
        await db.execute(delete(User).where(User.id == ids["auth"].id))
        await db.commit()


async def gastar(ids, dia, monto, categoria="comida", **kwargs):
    async with AsyncSessionLocal() as db:
        db.add(Movimiento(
            id_cuenta=ids["cuenta"], id_categoria=ids[categoria], tipo_movimiento=EnumTipoMovimiento.GASTO,
            tipo_gasto=EnumTipoGasto.VARIABLE, monto=monto, created_at=datetime.combine(dia, time(12, 0)),
            en_lugar_compra=False, **kwargs,
        ))
        await db.commit()


async def test_semana_y_metas_por_http(escenario):
    hoy = hoy_chile()
    semana_pasada = lunes_de(hoy) - timedelta(days=7)
    await gastar(escenario, hoy, 10000)
    await gastar(escenario, hoy, 50000, "tarjeta")
    await gastar(escenario, hoy, 30000, id_deuda=escenario["deuda"])
    await gastar(escenario, semana_pasada, 8000)

    app.dependency_overrides[current_user_or_api_key] = lambda: escenario["auth"]
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        r = await client.get("/api/finanzas/analitica/semanal")
        assert r.status_code == 200, r.text
        semana = r.json()
        assert semana["gasto_semana"] == 10000
        assert semana["gasto_excluido"] == 80000
        assert semana["gasto_semana_anterior"] == 8000
        assert semana["meta_semanal"] is None

        r = await client.get("/api/finanzas/metas-gasto/")
        assert r.status_code == 200, r.text
        cats = {c["id_categoria"]: c for c in r.json()["categorias"]}
        assert cats[escenario["tarjeta"]]["excluida"] is True
        assert cats[escenario["comida"]]["excluida"] is False

        r = await client.patch("/api/finanzas/metas-gasto/", json={
            "meta_semanal": 20000,
            "categorias": [
                {"id_categoria": escenario["tarjeta"], "excluida": False},
                {"id_categoria": escenario["comida"], "presupuesto_semanal": 12000},
            ],
        })
        assert r.status_code == 200, r.text
        metas_resp = r.json()
        cats = {c["id_categoria"]: c for c in metas_resp["categorias"]}
        assert metas_resp["meta_semanal"] == 20000
        assert cats[escenario["tarjeta"]]["excluida"] is False
        assert cats[escenario["comida"]]["presupuesto_semanal"] == 12000

        semana = (await client.get("/api/finanzas/analitica/semanal")).json()
        assert semana["gasto_semana"] == 60000
        assert semana["alertas"][0]["clave"].endswith(":semana:100")

        # Quitar el presupuesto no toca la meta; quitar la meta, tampoco las categorías.
        r = await client.patch("/api/finanzas/metas-gasto/", json={
            "categorias": [{"id_categoria": escenario["comida"], "presupuesto_semanal": None}],
        })
        cats = {c["id_categoria"]: c for c in r.json()["categorias"]}
        assert r.json()["meta_semanal"] == 20000
        assert cats[escenario["comida"]]["presupuesto_semanal"] is None
        r = await client.patch("/api/finanzas/metas-gasto/", json={"meta_semanal": None})
        assert r.json()["meta_semanal"] is None
        cats = {c["id_categoria"]: c for c in r.json()["categorias"]}
        assert cats[escenario["tarjeta"]]["excluida"] is False

        r = await client.patch("/api/finanzas/metas-gasto/", json={
            "categorias": [{"id_categoria": 999999999, "excluida": True}],
        })
        assert r.status_code == 404, r.text

        r = await client.get("/api/finanzas/analitica/semanas", params={"semanas": 8})
        assert r.status_code == 200, r.text
        tendencia = r.json()
        # Parte en la semana del primer movimiento, no 8 semanas atrás.
        assert [item["semana_inicio"] for item in tendencia["items"]] == [
            semana_pasada.isoformat(), lunes_de(hoy).isoformat()
        ]
        assert tendencia["promedio_semanas_completas"] == 8000


async def test_alerta_push_se_envia_una_sola_vez(escenario, monkeypatch):
    hoy = hoy_chile()
    await gastar(escenario, hoy, 15000)
    async with AsyncSessionLocal() as db:
        db.add_all([
            MetaGasto(id_usuario=escenario["usuario"], meta_semanal=10000),
            NotificationPreference(auth_user_id=escenario["auth"].id),
            PushSubscription(
                auth_user_id=escenario["auth"].id,
                endpoint=f"https://push.example.test/{uuid.uuid4().hex}",
                p256dh="p256dh-test-key-xxxxxxxxxx",
                auth_key="auth-test-key",
            ),
        ])
        await db.commit()

    enviados = []
    monkeypatch.setattr(metas, "send_budget_push", lambda _sub, titulo, cuerpo: enviados.append(titulo))
    now = datetime.now(CHILE_TZ)

    async with AsyncSessionLocal() as db:
        assert (escenario["auth"].id, escenario["usuario"]) in await metas.usuarios_con_metas(db)
    async with AsyncSessionLocal() as db:
        assert await metas.evaluar_usuario(db, escenario["auth"].id, escenario["usuario"], now) == 1
    async with AsyncSessionLocal() as db:
        assert await metas.evaluar_usuario(db, escenario["auth"].id, escenario["usuario"], now) == 0

    assert enviados == ["Te pasaste de la meta semanal"]
    async with AsyncSessionLocal() as db:
        claves = set(
            (await db.scalars(select(AlertaGasto.clave).where(AlertaGasto.auth_user_id == escenario["auth"].id))).all()
        )
    semana = lunes_de(hoy).isoformat()
    # Al pasar el 100% también queda marcado el 80%.
    assert {f"{semana}:semana:100", f"{semana}:semana:80"} <= claves

    # Sin meta ni presupuesto el usuario ya no es candidato.
    async with AsyncSessionLocal() as db:
        await db.execute(delete(MetaGasto).where(MetaGasto.id_usuario == escenario["usuario"]))
        await db.commit()
    async with AsyncSessionLocal() as db:
        assert (escenario["auth"].id, escenario["usuario"]) not in await metas.usuarios_con_metas(db)
