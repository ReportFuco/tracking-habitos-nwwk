"""Integración PostgreSQL de reglas de categoría y categorías ocultas.

Solo corre con RUN_DB_TESTS=1 y una base *_test (ver test_finanzas_movimientos_db.py).
"""
import os
import uuid
from datetime import date, datetime

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
        Banco,
        CategoriaFinanza,
        CuentaUsuario,
        Deuda,
        Movimiento,
        ProductoFinanciero,
        Usuario,
    )
    from app.models.finanzas import EnumTipoDeuda, EnumTipoGasto, EnumTipoMovimiento
    from app.models.usuario_auth import User


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
        auth = User(email=f"reglas-{sufijo}@example.com", hashed_password="x", is_active=True)
        db.add(auth)
        await db.flush()
        usuario = Usuario(
            username=f"r{sufijo}", nombre="Test", apellido="Reglas", telefono=sufijo[:8],
            email=auth.email, auth_user_id=auth.id,
        )
        banco = Banco(nombre_banco=f"Banco {sufijo}")
        db.add_all([usuario, banco])
        await db.flush()
        producto = ProductoFinanciero(id_banco=banco.id_banco, nombre_producto="Cuenta Vista")
        super_ = CategoriaFinanza(nombre="Supermercado", id_usuario=usuario.id_usuario)
        comida = CategoriaFinanza(nombre="Comida fuera", id_usuario=usuario.id_usuario)
        vieja = CategoriaFinanza(nombre=f"alimentacion-{sufijo}")
        deuda = Deuda(id_usuario=usuario.id_usuario, tipo=EnumTipoDeuda.DEBO, nombre="Crédito", monto_total=900000)
        db.add_all([producto, super_, comida, vieja, deuda])
        await db.flush()
        cuenta = CuentaUsuario(
            id_usuario=usuario.id_usuario,
            id_producto_financiero=producto.id_producto_financiero,
            nombre_cuenta="Débito",
        )
        db.add(cuenta)
        await db.flush()

        def gasto(categoria, monto, descripcion, **kwargs):
            return Movimiento(
                id_cuenta=cuenta.id_cuenta, id_categoria=categoria.id_categoria,
                tipo_movimiento=EnumTipoMovimiento.GASTO, tipo_gasto=EnumTipoGasto.VARIABLE,
                monto=monto, descripcion=descripcion, created_at=datetime(2026, 9, 10, 12, 0),
                en_lugar_compra=False, **kwargs,
            )

        historial = [
            gasto(vieja, 16420, "TOTTUS HUECHURABA SANTIAGO CHL"),
            gasto(vieja, 8590, "PAYU UBER EATS SANTIAGO CHL"),
            gasto(vieja, 3300, "Almuerzo con la familia"),
            # Elegida a propósito en otra categoría: con solo_desde_categorias no se toca.
            gasto(comida, 5000, "TOTTUS express"),
            gasto(vieja, 100000, "TOTTUS pago crédito", id_deuda=deuda.id_deuda),
        ]
        db.add_all(historial)
        await db.commit()
        ids = {
            "auth": auth, "usuario": usuario.id_usuario, "cuenta": cuenta.id_cuenta, "otros": otros.id_categoria,
            "super": super_.id_categoria, "comida": comida.id_categoria, "vieja": vieja.id_categoria,
            "deuda": deuda.id_deuda, "creo_otros": creo_otros,
        }

    app.dependency_overrides[current_user_or_api_key] = lambda: ids["auth"]
    yield ids
    app.dependency_overrides.clear()

    async with AsyncSessionLocal() as db:
        await db.execute(delete(Movimiento).where(Movimiento.id_cuenta == ids["cuenta"]))
        await db.execute(delete(CuentaUsuario).where(CuentaUsuario.id_cuenta == ids["cuenta"]))
        await db.execute(delete(Deuda).where(Deuda.id_deuda == ids["deuda"]))
        await db.execute(delete(Usuario).where(Usuario.id_usuario == ids["usuario"]))
        # Propias, reglas y preferencias caen por ON DELETE CASCADE.
        borrar = [ids["vieja"]] + ([ids["otros"]] if ids["creo_otros"] else [])
        await db.execute(delete(CategoriaFinanza).where(CategoriaFinanza.id_categoria.in_(borrar)))
        await db.execute(delete(User).where(User.id == ids["auth"].id))
        await db.commit()


def cliente():
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")


def gasto_nuevo(ids, descripcion, **kwargs):
    return {
        "id_cuenta": ids["cuenta"], "tipo_movimiento": "gasto", "tipo_gasto": "variable",
        "monto": 2500, "descripcion": descripcion, **kwargs,
    }


async def test_reglas_al_registrar_y_aplicar_al_historial(escenario):
    async with cliente() as c:
        r = await c.post("/api/finanzas/reglas-categoria/", json=[
            {"patron": "tottus", "id_categoria": escenario["super"]},
            {"patron": "UBER EATS", "id_categoria": escenario["comida"]},
        ])
        assert r.status_code == 201, r.text
        # Mismo patrón con otras mayúsculas: actualiza, no duplica.
        r = await c.post("/api/finanzas/reglas-categoria/", json=[{"patron": "TOTTUS", "id_categoria": escenario["super"]}])
        assert r.status_code == 201, r.text
        reglas = (await c.get("/api/finanzas/reglas-categoria/")).json()
        assert sorted(regla["patron"] for regla in reglas) == ["TOTTUS", "UBER EATS"]

        # El Atajo manda «Otros» con el nombre del comercio: la regla lo corrige.
        r = await c.post("/api/finanzas/movimientos/", json=gasto_nuevo(escenario, "Tottus", id_categoria=escenario["otros"]))
        assert r.status_code == 201, r.text
        assert r.json()["id_categoria"] == escenario["super"]
        # Sin categoría y sin regla que calce: «Otros».
        r = await c.post("/api/finanzas/movimientos/", json=gasto_nuevo(escenario, "Kiosko"))
        assert r.status_code == 201, r.text
        assert r.json()["id_categoria"] == escenario["otros"]
        # Una categoría elegida explícitamente se respeta.
        r = await c.post("/api/finanzas/movimientos/", json=gasto_nuevo(escenario, "Tottus", id_categoria=escenario["comida"]))
        assert r.json()["id_categoria"] == escenario["comida"]

        cuerpo = {"solo_desde_categorias": [escenario["vieja"]], "desde": "2026-09-01", "hasta": "2026-09-30"}
        vista = (await c.post("/api/finanzas/reglas-categoria/aplicar", json=cuerpo)).json()
        assert vista["aplicado"] is False
        # El abono a deuda y lo que no calza no cambian; TOTTUS express está en otra categoría.
        assert vista["revisados"] == 3
        assert {(g["categoria_nueva"], g["cantidad"]) for g in vista["cambios"]} == {("Supermercado", 1), ("Comida fuera", 1)}

        hecho = (await c.post("/api/finanzas/reglas-categoria/aplicar", json={**cuerpo, "confirmar": True})).json()
        assert hecho["aplicado"] is True and hecho["cambiados"] == 2
        otra_vez = (await c.post("/api/finanzas/reglas-categoria/aplicar", json=cuerpo)).json()
        assert otra_vez["cambiados"] == 0

        r = await c.delete(f"/api/finanzas/reglas-categoria/{reglas[0]['id_regla']}")
        assert r.status_code == 204

    async with AsyncSessionLocal() as db:
        abono = await db.scalar(select(Movimiento).where(Movimiento.id_deuda == escenario["deuda"]))
        assert abono.id_categoria == escenario["vieja"]


async def test_ocultar_y_ordenar_por_uso(escenario):
    async with cliente() as c:
        r = await c.put(f"/api/finanzas/categoria/{escenario['vieja']}/oculta", json={"oculta": True})
        assert r.status_code == 200, r.text
        assert r.json()["oculta"] is True

        visibles = (await c.get("/api/finanzas/categoria/")).json()
        ids = [cat["id_categoria"] for cat in visibles]
        assert escenario["vieja"] not in ids
        todas = (await c.get("/api/finanzas/categoria/", params={"incluir_ocultas": True})).json()
        oculta = next(cat for cat in todas if cat["id_categoria"] == escenario["vieja"])
        assert oculta["oculta"] is True

        # Comida fuera tiene un movimiento reciente y Supermercado ninguno: va antes.
        await c.post("/api/finanzas/movimientos/", json=gasto_nuevo(escenario, "Sushi", id_categoria=escenario["comida"]))
        visibles = (await c.get("/api/finanzas/categoria/")).json()
        ids = [cat["id_categoria"] for cat in visibles]
        assert ids.index(escenario["comida"]) < ids.index(escenario["super"])
        comida = next(cat for cat in visibles if cat["id_categoria"] == escenario["comida"])
        assert comida["usos_recientes"] >= 1

        r = await c.put(f"/api/finanzas/categoria/{escenario['vieja']}/oculta", json={"oculta": False})
        assert r.json()["oculta"] is False
        assert escenario["vieja"] in [cat["id_categoria"] for cat in (await c.get("/api/finanzas/categoria/")).json()]


async def test_mover_movimientos_a_otra_categoria(escenario):
    async with cliente() as c:
        url = f"/api/finanzas/categoria/{escenario['vieja']}/mover-movimientos"
        vista = (await c.post(url, json={"id_categoria_destino": escenario["comida"]})).json()
        assert vista["aplicado"] is False
        assert (vista["cantidad"], vista["monto_total"]) == (4, 16420 + 8590 + 3300 + 100000)

        hecho = (await c.post(url, json={"id_categoria_destino": escenario["comida"], "confirmar": True})).json()
        assert hecho["cantidad"] == 4
        otra_vez = (await c.post(url, json={"id_categoria_destino": escenario["comida"]})).json()
        assert otra_vez["cantidad"] == 0

        misma = await c.post(url, json={"id_categoria_destino": escenario["vieja"]})
        assert misma.status_code == 400
