"""Rutas REST de categorías propias, productos propuestos y productos dentro de un gasto.

Integración HTTP + PostgreSQL con API key, como test_mcp_finanzas.py: solo corre con
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
    from app.models import ApiKey, Banco, CuentaUsuario, Movimiento, Producto, ProductoFinanciero, Usuario
    from app.models.usuario_auth import User


@pytest.fixture
async def usuario_con_key():
    sufijo = uuid.uuid4().hex[:8]
    async with AsyncSessionLocal() as db:
        auth = User(email=f"rest_{sufijo}@mail.com", hashed_password="x", is_active=True, is_superuser=False, is_verified=True)
        db.add(auth)
        await db.flush()
        perfil = Usuario(
            username=f"rest{sufijo}", nombre="R", apellido="Est", telefono=f"3{sufijo[:7]}",
            email=auth.email, auth_user_id=auth.id,
        )
        banco = Banco(nombre_banco=f"Banco REST {sufijo}")
        db.add_all([perfil, banco])
        await db.flush()
        producto_fin = ProductoFinanciero(id_banco=banco.id_banco, nombre_producto="Cuenta Vista")
        db.add(producto_fin)
        await db.flush()
        cuenta = CuentaUsuario(
            id_usuario=perfil.id_usuario,
            id_producto_financiero=producto_fin.id_producto_financiero,
            nombre_cuenta="Debito",
        )
        db.add(cuenta)
        valor, prefijo, key_hash = generate_api_key()
        db.add(ApiKey(auth_user_id=auth.id, nombre="rest", key_prefix=prefijo, key_hash=key_hash, scopes=["*"], activo=True))
        await db.commit()
        datos = {
            "headers": {"X-API-Key": valor},
            "sufijo": sufijo,
            "cuenta": cuenta.id_cuenta,
            "perfil": perfil.id_usuario,
            "auth": auth.id,
            "banco": banco.id_banco,
            "producto_fin": producto_fin.id_producto_financiero,
        }

    yield datos

    async with AsyncSessionLocal() as db:
        await db.execute(delete(Movimiento).where(Movimiento.id_cuenta == datos["cuenta"]))
        await db.execute(delete(Producto).where(Producto.id_usuario_creador == datos["perfil"]))
        await db.execute(delete(CuentaUsuario).where(CuentaUsuario.id_cuenta == datos["cuenta"]))
        await db.execute(delete(ProductoFinanciero).where(ProductoFinanciero.id_producto_financiero == datos["producto_fin"]))
        await db.execute(delete(Banco).where(Banco.id_banco == datos["banco"]))
        await db.execute(delete(ApiKey).where(ApiKey.auth_user_id == datos["auth"]))
        # Sus categorías propias caen en cascada con el perfil.
        await db.execute(delete(Usuario).where(Usuario.id_usuario == datos["perfil"]))
        await db.execute(delete(User).where(User.id == datos["auth"]))
        await db.commit()


async def test_flujo_rest_categoria_propia_producto_y_detalle_del_gasto(usuario_con_key):
    h = usuario_con_key["headers"]
    s = usuario_con_key["sufijo"]
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
        categoria = await c.post("/api/finanzas/categoria/", json={"nombre": f"Mascotas {s}"}, headers=h)
        assert categoria.status_code == 201, categoria.text
        assert categoria.json()["es_propia"] is True
        id_categoria = categoria.json()["id_categoria"]

        por_defecto = await c.post(
            "/api/finanzas/categoria/", json={"nombre": f"Global {s}", "por_defecto": True}, headers=h
        )
        assert por_defecto.status_code == 403

        gasto = await c.post("/api/finanzas/movimientos/", headers=h, json={
            "id_categoria": id_categoria, "id_cuenta": usuario_con_key["cuenta"],
            "tipo_movimiento": "gasto", "tipo_gasto": "variable", "monto": 9000,
        })
        assert gasto.status_code == 201, gasto.text
        assert gasto.json()["id_categoria"] == id_categoria
        assert gasto.json()["items"] == []
        id_mov = gasto.json()["id_transaccion"]

        producto = await c.post(
            "/api/catalogo/producto/", json={"nombre_producto": f"Arena gato {s}", "contenido_neto": 10, "unidad_contenido": "kg"},
            headers=h,
        )
        assert producto.status_code == 201, producto.text
        assert producto.json()["estado"] == "pendiente"
        id_producto = producto.json()["id_producto"]

        busqueda = await c.get("/api/catalogo/producto/", params={"q": f"arena {s}"}, headers=h)
        assert [p["id_producto"] for p in busqueda.json()] == [id_producto]

        con_item = await c.post(
            f"/api/finanzas/movimientos/{id_mov}/items",
            json={"id_producto": id_producto, "cantidad": 2, "precio_total": 7980},
            headers=h,
        )
        assert con_item.status_code == 201, con_item.text
        cuerpo = con_item.json()
        assert cuerpo["total_detallado"] == 7980
        assert cuerpo["items"][0]["precio_unitario"] == 3990
        assert cuerpo["items"][0]["detalle_producto"] == "10 kg"
        id_item = cuerpo["items"][0]["id_item"]

        editado = await c.patch(
            f"/api/finanzas/movimientos/{id_mov}/items/{id_item}", json={"precio_total": None}, headers=h
        )
        assert editado.status_code == 200, editado.text
        assert editado.json()["total_detallado"] == 0

        frecuentes = await c.get("/api/catalogo/producto/frecuentes", headers=h)
        assert [p["id_producto"] for p in frecuentes.json()] == [id_producto]

        revision = await c.get("/api/catalogo/producto/revision", headers=h)
        assert revision.status_code in (401, 403)

        a_ingreso = await c.patch(f"/api/finanzas/movimientos/{id_mov}", json={"tipo_movimiento": "ingreso"}, headers=h)
        assert a_ingreso.status_code == 409

        quitado = await c.delete(f"/api/finanzas/movimientos/{id_mov}/items/{id_item}", headers=h)
        assert quitado.status_code == 200 and quitado.json()["items"] == []

        # Con movimientos, borrar la categoría la archiva: deja de listarse salvo que se pida.
        borrada = await c.delete(f"/api/finanzas/categoria/{id_categoria}", headers=h)
        assert borrada.status_code == 204
        activas = await c.get("/api/finanzas/categoria/", headers=h)
        todas = await c.get("/api/finanzas/categoria/", params={"incluir_archivadas": True}, headers=h)
        assert id_categoria not in {x["id_categoria"] for x in activas.json()}
        assert {"id_categoria": id_categoria, "activo": False}.items() <= next(
            x for x in todas.json() if x["id_categoria"] == id_categoria
        ).items()


async def test_crear_gasto_con_productos_en_una_sola_solicitud(usuario_con_key):
    h = usuario_con_key["headers"]
    s = usuario_con_key["sufijo"]
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
        categoria = await c.post("/api/finanzas/categoria/", json={"nombre": f"Super {s}"}, headers=h)
        id_categoria = categoria.json()["id_categoria"]
        producto = await c.post("/api/catalogo/producto/", json={"nombre_producto": f"Pan {s}"}, headers=h)
        id_producto = producto.json()["id_producto"]
        base = {
            "id_categoria": id_categoria, "id_cuenta": usuario_con_key["cuenta"],
            "tipo_gasto": "variable", "monto": 5000,
        }

        gasto = await c.post("/api/finanzas/movimientos/", headers=h, json={
            **base, "tipo_movimiento": "gasto",
            "items": [
                {"id_producto": id_producto, "cantidad": 0.75, "precio_total": 1500},
                {"id_producto": id_producto},
            ],
        })
        assert gasto.status_code == 201, gasto.text
        cuerpo = gasto.json()
        assert len(cuerpo["items"]) == 2
        assert cuerpo["total_detallado"] == 1500
        assert cuerpo["items"][0]["precio_unitario"] == 2000

        # Un ingreso no puede traer productos.
        ingreso = await c.post("/api/finanzas/movimientos/", headers=h, json={
            **base, "tipo_movimiento": "ingreso", "items": [{"id_producto": id_producto}],
        })
        assert ingreso.status_code == 422

        # Un producto inexistente no deja el gasto creado a medias.
        antes = await c.get("/api/finanzas/movimientos/", headers=h)
        invalido = await c.post("/api/finanzas/movimientos/", headers=h, json={
            **base, "tipo_movimiento": "gasto", "items": [{"id_producto": 999_999_999}],
        })
        assert invalido.status_code == 404, invalido.text
        despues = await c.get("/api/finanzas/movimientos/", headers=h)
        assert len(despues.json()["items"]) == len(antes.json()["items"])
