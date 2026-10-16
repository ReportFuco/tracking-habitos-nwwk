"""Integracion PostgreSQL del recordatorio diario de gastos.

Solo corre con RUN_DB_TESTS=1 y una base *_test (ver test_finanzas_movimientos_db.py).
"""
import os
import uuid
from datetime import date, datetime, time

import pytest

DB_URL = os.environ.get("DATABASE_URL", "")
RUN = os.environ.get("RUN_DB_TESTS") == "1" and DB_URL.rsplit("/", 1)[-1].endswith("_test")
pytestmark = [
    pytest.mark.skipif(not RUN, reason="Requiere RUN_DB_TESTS=1 y una base *_test."),
    pytest.mark.asyncio(loop_scope="session"),
]

if RUN:
    import httpx
    from pywebpush import WebPushException
    from sqlalchemy import delete, select

    from app.auth.fastapi_users import current_user
    from app.db.session import AsyncSessionLocal
    from app.main import app
    from app.models import (
        Banco,
        CategoriaFinanza,
        CuentaUsuario,
        Movimiento,
        NotificationPreference,
        ProductoFinanciero,
        PushSubscription,
        Usuario,
    )
    from app.models.finanzas import EnumTipoGasto, EnumTipoMovimiento
    from app.models.usuario_auth import User
    from app.notifications import gastos
    from app.notifications.gastos import (
        CHILE_TZ,
        claim_due_expense_reminders,
        registered_expense_on,
        send_expense_reminder,
    )


@pytest.fixture
async def escenario():
    """Usuario con una cuenta, un dispositivo suscrito y el aviso de gastos a las 20:00."""
    sufijo = uuid.uuid4().hex[:8]
    async with AsyncSessionLocal() as db:
        auth = User(email=f"push-{sufijo}@example.com", hashed_password="x", is_active=True)
        db.add(auth)
        await db.flush()
        usuario = Usuario(
            username=f"p{sufijo}", nombre="Test", apellido="Push", telefono=sufijo[:8],
            email=auth.email, auth_user_id=auth.id,
        )
        banco = Banco(nombre_banco=f"Banco {sufijo}")
        db.add_all([usuario, banco])
        await db.flush()
        producto = ProductoFinanciero(id_banco=banco.id_banco, nombre_producto="Cuenta Vista")
        categoria = CategoriaFinanza(nombre=f"comida-{sufijo}")
        db.add_all([producto, categoria])
        await db.flush()
        cuenta = CuentaUsuario(
            id_usuario=usuario.id_usuario,
            id_producto_financiero=producto.id_producto_financiero,
            nombre_cuenta="RUT",
        )
        db.add_all([
            cuenta,
            NotificationPreference(
                auth_user_id=auth.id,
                expense_reminders_enabled=True,
                expense_reminder_time=time(20, 0),
            ),
            PushSubscription(
                auth_user_id=auth.id,
                endpoint=f"https://push.example.test/{sufijo}",
                p256dh="p256dh-test-key-xxxxxxxxxx",
                auth_key="auth-test-key",
            ),
        ])
        await db.commit()
        ids = {"auth": auth, "cuenta": cuenta.id_cuenta, "categoria": categoria.id_categoria}

    yield ids
    app.dependency_overrides.clear()

    async with AsyncSessionLocal() as db:
        await db.execute(delete(Movimiento).where(Movimiento.id_cuenta == ids["cuenta"]))
        await db.execute(delete(CuentaUsuario).where(CuentaUsuario.id_cuenta == ids["cuenta"]))
        await db.execute(delete(CategoriaFinanza).where(CategoriaFinanza.id_categoria == ids["categoria"]))
        await db.execute(delete(Usuario).where(Usuario.auth_user_id == ids["auth"].id))
        # Preferencias y suscripciones caen por ON DELETE CASCADE.
        await db.execute(delete(User).where(User.id == ids["auth"].id))
        await db.commit()


async def agregar_movimiento(ids, fecha, tipo):
    async with AsyncSessionLocal() as db:
        db.add(Movimiento(
            id_cuenta=ids["cuenta"], id_categoria=ids["categoria"], tipo_movimiento=tipo,
            tipo_gasto=EnumTipoGasto.VARIABLE, monto=1000, created_at=fecha, en_lugar_compra=False,
        ))
        await db.commit()


async def reclamar(momento):
    async with AsyncSessionLocal() as db:
        async with db.begin():
            return await claim_due_expense_reminders(db, momento)


async def test_avisa_una_sola_vez_al_dia_y_recien_a_la_hora(escenario):
    user_id = escenario["auth"].id

    assert user_id not in await reclamar(datetime(2026, 10, 15, 19, 59, tzinfo=CHILE_TZ))
    assert user_id in await reclamar(datetime(2026, 10, 15, 20, 0, tzinfo=CHILE_TZ))
    assert user_id not in await reclamar(datetime(2026, 10, 15, 22, 0, tzinfo=CHILE_TZ))
    assert user_id in await reclamar(datetime(2026, 10, 16, 20, 5, tzinfo=CHILE_TZ))


async def test_solo_cuentan_los_gastos_del_dia(escenario):
    user_id = escenario["auth"].id
    hoy = date(2026, 10, 15)

    await agregar_movimiento(escenario, datetime(2026, 10, 14, 23, 50), EnumTipoMovimiento.GASTO)
    await agregar_movimiento(escenario, datetime(2026, 10, 15, 9, 0), EnumTipoMovimiento.INGRESO)
    async with AsyncSessionLocal() as db:
        assert not await registered_expense_on(db, user_id, hoy)

    await agregar_movimiento(escenario, datetime(2026, 10, 15, 0, 10), EnumTipoMovimiento.GASTO)
    async with AsyncSessionLocal() as db:
        assert await registered_expense_on(db, user_id, hoy)


async def test_suscripcion_revocada_se_desactiva(escenario, monkeypatch):
    def revocada(_subscription):
        raise WebPushException("gone", response=type("R", (), {"status_code": 410})())

    monkeypatch.setattr(gastos, "send_expense_push", revocada)
    async with AsyncSessionLocal() as db:
        assert await send_expense_reminder(db, escenario["auth"].id) == 0

    async with AsyncSessionLocal() as db:
        subscription = await db.scalar(
            select(PushSubscription).where(PushSubscription.auth_user_id == escenario["auth"].id)
        )
        assert subscription.enabled is False


async def test_aviso_enviado_a_cada_dispositivo(escenario, monkeypatch):
    enviados = []
    monkeypatch.setattr(gastos, "send_expense_push", enviados.append)
    async with AsyncSessionLocal() as db:
        assert await send_expense_reminder(db, escenario["auth"].id) == 1
    assert len(enviados) == 1


async def test_preferencias_por_http(escenario):
    app.dependency_overrides[current_user] = lambda: escenario["auth"]
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        r = await client.get("/api/notifications/status")
        assert r.status_code == 200, r.text
        assert r.json()["expense_reminder_time"] == "20:00"

        r = await client.patch("/api/notifications/preferences", json={"expense_reminder_time": "07:15"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["expense_reminders_enabled"] is True
        assert body["expense_reminder_time"] == "07:15"
        assert body["active_subscriptions"] == 1

        r = await client.patch("/api/notifications/preferences", json={"expense_reminders_enabled": False})
        assert r.json()["expense_reminders_enabled"] is False
        assert r.json()["expense_reminder_time"] == "07:15"
