"""Integración PostgreSQL del aviso para detallar la boleta de una compra del Atajo.

Solo corre con RUN_DB_TESTS=1 y una base *_test (ver test_finanzas_movimientos_db.py).
"""
import os
import uuid

import pytest

DB_URL = os.environ.get("DATABASE_URL", "")
RUN = os.environ.get("RUN_DB_TESTS") == "1" and DB_URL.rsplit("/", 1)[-1].endswith("_test")
pytestmark = [
    pytest.mark.skipif(not RUN, reason="Requiere RUN_DB_TESTS=1 y una base *_test."),
    pytest.mark.asyncio(loop_scope="session"),
]

if RUN:
    import httpx
    from sqlalchemy import delete, func, select

    from app.auth.fastapi_users import current_user_or_api_key
    from app.db.session import AsyncSessionLocal
    from app.main import app
    from app.models import (
        AvisoDetalleCompra,
        Banco,
        CategoriaFinanza,
        CuentaUsuario,
        Movimiento,
        MovimientoItem,
        Producto,
        ProductoFinanciero,
        PushSubscription,
        Usuario,
    )
    from app.models.usuario_auth import User
    from app.notifications import compras
    from app.notifications.compras import process_purchase_detail_alerts


@pytest.fixture
async def escenario():
    sufijo = uuid.uuid4().hex[:8]
    async with AsyncSessionLocal() as db:
        otros = await db.scalar(
            select(CategoriaFinanza).where(
                CategoriaFinanza.id_usuario.is_(None), func.lower(CategoriaFinanza.nombre) == "otros"
            )
        )
        creo_otros = otros is None
        if creo_otros:
            otros = CategoriaFinanza(nombre="Otros")
            db.add(otros)
        auth = User(email=f"boletas-{sufijo}@example.com", hashed_password="x", is_active=True)
        db.add(auth)
        await db.flush()
        usuario = Usuario(
            username=f"b{sufijo}", nombre="Test", apellido="Boletas", telefono=sufijo[:8],
            email=auth.email, auth_user_id=auth.id,
        )
        banco = Banco(nombre_banco=f"Banco {sufijo}")
        db.add_all([usuario, banco])
        await db.flush()
        producto = ProductoFinanciero(id_banco=banco.id_banco, nombre_producto="Cuenta Vista")
        super_ = CategoriaFinanza(nombre="Supermercado", id_usuario=usuario.id_usuario)
        comida = CategoriaFinanza(nombre="Comida fuera", id_usuario=usuario.id_usuario)
        db.add_all([producto, super_, comida])
        await db.flush()
        cuenta = CuentaUsuario(
            id_usuario=usuario.id_usuario,
            id_producto_financiero=producto.id_producto_financiero,
            nombre_cuenta="Débito",
        )
        db.add_all([
            cuenta,
            PushSubscription(
                auth_user_id=auth.id,
                endpoint=f"https://push.example.test/boletas-{sufijo}",
                p256dh="p256dh-test-key-xxxxxxxxxx",
                auth_key="auth-test-key",
            ),
        ])
        await db.commit()
        ids = {
            "auth": auth, "usuario": usuario.id_usuario, "cuenta": cuenta.id_cuenta, "otros": otros.id_categoria,
            "super": super_.id_categoria, "comida": comida.id_categoria, "creo_otros": creo_otros,
            "banco": banco.id_banco, "producto": producto.id_producto_financiero,
        }

    app.dependency_overrides[current_user_or_api_key] = lambda: ids["auth"]
    yield ids
    app.dependency_overrides.clear()

    async with AsyncSessionLocal() as db:
        # Los avisos caen con sus movimientos; propias y preferencias, con el usuario.
        await db.execute(delete(Movimiento).where(Movimiento.id_cuenta == ids["cuenta"]))
        await db.execute(delete(CuentaUsuario).where(CuentaUsuario.id_cuenta == ids["cuenta"]))
        await db.execute(delete(PushSubscription).where(PushSubscription.auth_user_id == ids["auth"].id))
        await db.execute(delete(Usuario).where(Usuario.id_usuario == ids["usuario"]))
        await db.execute(delete(ProductoFinanciero).where(ProductoFinanciero.id_producto_financiero == ids["producto"]))
        await db.execute(delete(Banco).where(Banco.id_banco == ids["banco"]))
        if ids["creo_otros"]:
            await db.execute(delete(CategoriaFinanza).where(CategoriaFinanza.id_categoria == ids["otros"]))
        await db.execute(delete(User).where(User.id == ids["auth"].id))
        await db.commit()


def cliente():
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")


def gasto(ids, descripcion, **kwargs):
    return {
        "id_cuenta": ids["cuenta"], "tipo_movimiento": "gasto", "tipo_gasto": "variable",
        "monto": 23450, "descripcion": descripcion, **kwargs,
    }


async def avisos(ids_movimiento):
    async with AsyncSessionLocal() as db:
        return set(
            (
                await db.scalars(
                    select(AvisoDetalleCompra.id_movimiento).where(AvisoDetalleCompra.id_movimiento.in_(ids_movimiento))
                )
            ).all()
        )


async def test_solo_el_atajo_en_categorias_que_piden_detalle_avisa(escenario):
    async with cliente() as c:
        atajo = await c.post("/api/finanzas/movimientos/", json=gasto(
            escenario, "LIDER EXPRESS", id_categoria=escenario["super"], recordar_detalle=True,
        ))
        assert atajo.status_code == 201, atajo.text
        # Desde la app (sin recordar_detalle) no avisa aunque sea supermercado.
        app_web = await c.post("/api/finanzas/movimientos/", json=gasto(escenario, "Jumbo", id_categoria=escenario["super"]))
        # El Atajo en una categoría que no pide detalle tampoco.
        cafe = await c.post("/api/finanzas/movimientos/", json=gasto(
            escenario, "Starbucks", id_categoria=escenario["comida"], recordar_detalle=True,
        ))
        assert (await avisos([atajo.json()["id_transaccion"], app_web.json()["id_transaccion"],
                              cafe.json()["id_transaccion"]])) == {atajo.json()["id_transaccion"]}

        categorias = (await c.get("/api/finanzas/categoria/")).json()
        pide = {cat["id_categoria"]: cat["pedir_detalle"] for cat in categorias}
        assert pide[escenario["super"]] is True and pide[escenario["comida"]] is False

        r = await c.put(f"/api/finanzas/categoria/{escenario['comida']}/pedir-detalle", json={"pedir_detalle": True})
        assert r.status_code == 200, r.text
        assert r.json()["pedir_detalle"] is True
        r = await c.put(f"/api/finanzas/categoria/{escenario['super']}/pedir-detalle", json={"pedir_detalle": False})
        assert r.json()["pedir_detalle"] is False

        cafe2 = await c.post("/api/finanzas/movimientos/", json=gasto(
            escenario, "Starbucks", id_categoria=escenario["comida"], recordar_detalle=True,
        ))
        super2 = await c.post("/api/finanzas/movimientos/", json=gasto(
            escenario, "Lider", id_categoria=escenario["super"], recordar_detalle=True,
        ))
        assert (await avisos([cafe2.json()["id_transaccion"], super2.json()["id_transaccion"]])) == {
            cafe2.json()["id_transaccion"]
        }


async def test_el_worker_avisa_una_vez_y_no_si_ya_se_detallo(escenario, monkeypatch):
    enviados = []
    monkeypatch.setattr(
        compras,
        "send_purchase_detail_push",
        lambda subscription, id_movimiento, title, body: enviados.append((id_movimiento, title, body)),
    )
    async with cliente() as c:
        pendiente = (await c.post("/api/finanzas/movimientos/", json=gasto(
            escenario, "LIDER EXPRESS", id_categoria=escenario["super"], recordar_detalle=True,
        ))).json()
        detallado = (await c.post("/api/finanzas/movimientos/", json=gasto(
            escenario, "Unimarc", id_categoria=escenario["super"], recordar_detalle=True,
        ))).json()

    # La segunda la detalló antes de que pasara el worker.
    async with AsyncSessionLocal() as db:
        producto = Producto(nombre_producto=f"Pan {uuid.uuid4().hex[:6]}", estado="aprobado")
        db.add(producto)
        await db.flush()
        db.add(MovimientoItem(id_movimiento=detallado["id_transaccion"], id_producto=producto.id_producto))
        await db.commit()
        id_producto = producto.id_producto

    try:
        await process_purchase_detail_alerts(AsyncSessionLocal)
        await process_purchase_detail_alerts(AsyncSessionLocal)

        mios = [envio for envio in enviados if envio[0] in (pendiente["id_transaccion"], detallado["id_transaccion"])]
        assert len(mios) == 1
        id_movimiento, title, body = mios[0]
        assert id_movimiento == pendiente["id_transaccion"]
        assert title == "¿Detallas tu compra en LIDER EXPRESS?"
        assert "$23.450" in body
        async with AsyncSessionLocal() as db:
            aviso = await db.get(AvisoDetalleCompra, pendiente["id_transaccion"])
            assert aviso.enviado_at is not None
    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(Movimiento).where(Movimiento.id_transaccion == detallado["id_transaccion"]))
            await db.execute(delete(Producto).where(Producto.id_producto == id_producto))
            await db.commit()
