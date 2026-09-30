"""Rutas REST de deudas y sus abonos (movimientos con id_deuda).

Integración HTTP + PostgreSQL con API key, como test_rest_categorias_productos.py: solo
corre con RUN_DB_TESTS=1 y un DATABASE_URL cuya base termine en "_test".
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
        auth = User(email=f"deuda_{sufijo}@mail.com", hashed_password="x", is_active=True, is_verified=True)
        db.add(auth)
        await db.flush()
        perfil = Usuario(
            username=f"deu{sufijo}", nombre="D", apellido="Euda", telefono=f"4{sufijo[:7]}",
            email=auth.email, auth_user_id=auth.id,
        )
        banco = Banco(nombre_banco=f"Banco deudas {sufijo}")
        db.add_all([perfil, banco])
        await db.flush()
        producto_fin = ProductoFinanciero(id_banco=banco.id_banco, nombre_producto="Cuenta Vista")
        categoria = CategoriaFinanza(nombre=f"pagos-{sufijo}", id_usuario=perfil.id_usuario)
        db.add_all([producto_fin, categoria])
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
            "cuenta": cuenta.id_cuenta,
            "categoria": categoria.id_categoria,
            "perfil": perfil.id_usuario,
            "auth": auth.id,
            "banco": banco.id_banco,
            "producto_fin": producto_fin.id_producto_financiero,
        }

    yield datos

    async with AsyncSessionLocal() as db:
        await db.execute(delete(Movimiento).where(Movimiento.id_cuenta == datos["cuenta"]))
        await db.execute(delete(CuentaUsuario).where(CuentaUsuario.id_cuenta == datos["cuenta"]))
        await db.execute(delete(ProductoFinanciero).where(ProductoFinanciero.id_producto_financiero == datos["producto_fin"]))
        await db.execute(delete(Banco).where(Banco.id_banco == datos["banco"]))
        await db.execute(delete(ApiKey).where(ApiKey.auth_user_id == datos["auth"]))
        # Sus deudas y categorías propias caen en cascada con el perfil.
        await db.execute(delete(Usuario).where(Usuario.id_usuario == datos["perfil"]))
        await db.execute(delete(User).where(User.id == datos["auth"]))
        await db.commit()


async def test_deuda_se_abona_con_gastos_y_queda_pagada(usuario):
    h = usuario["headers"]

    def movimiento(monto, tipo="gasto", **extra):
        return {
            "id_categoria": usuario["categoria"], "id_cuenta": usuario["cuenta"],
            "tipo_movimiento": tipo, "tipo_gasto": "variable", "monto": monto, **extra,
        }

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
        credito = await c.post("/api/finanzas/deudas/", headers=h, json={
            "tipo": "debo", "nombre": "  Crédito   consumo ", "contraparte": "Banco", "monto_total": 100000,
        })
        assert credito.status_code == 201, credito.text
        assert credito.json()["nombre"] == "Crédito consumo"
        assert credito.json()["saldo"] == 100000 and credito.json()["estado"] == "activa"
        id_credito = credito.json()["id_deuda"]
        prestamo = await c.post("/api/finanzas/deudas/", headers=h, json={
            "tipo": "me_deben", "nombre": "Préstamo a Juan", "monto_total": 50000,
        })
        id_prestamo = prestamo.json()["id_deuda"]

        abono = await c.post("/api/finanzas/movimientos/", headers=h, json=movimiento(30000, id_deuda=id_credito))
        assert abono.status_code == 201, abono.text
        assert abono.json()["id_deuda"] == id_credito and abono.json()["deuda"] == "Crédito consumo"
        id_abono = abono.json()["id_transaccion"]

        # Un ingreso no abona lo que se debe, ni un gasto lo que le deben a uno.
        ingreso = await c.post("/api/finanzas/movimientos/", headers=h, json=movimiento(1000, "ingreso", id_deuda=id_credito))
        gasto_a_prestamo = await c.post("/api/finanzas/movimientos/", headers=h, json=movimiento(1000, id_deuda=id_prestamo))
        excede = await c.post("/api/finanzas/movimientos/", headers=h, json=movimiento(80000, id_deuda=id_credito))
        assert ingreso.status_code == 409
        assert gasto_a_prestamo.status_code == 409
        assert excede.status_code == 409 and "$70.000" in excede.json()["detail"]

        cobro = await c.post("/api/finanzas/movimientos/", headers=h, json=movimiento(20000, "ingreso", id_deuda=id_prestamo))
        assert cobro.status_code == 201, cobro.text

        # Editar el abono revalida el saldo excluyéndose a sí mismo.
        subir_demas = await c.patch(f"/api/finanzas/movimientos/{id_abono}", headers=h, json={"monto": 100001})
        a_ingreso = await c.patch(f"/api/finanzas/movimientos/{id_abono}", headers=h, json={"tipo_movimiento": "ingreso"})
        pagar_todo = await c.patch(f"/api/finanzas/movimientos/{id_abono}", headers=h, json={"monto": 100000})
        assert subir_demas.status_code == 409
        assert a_ingreso.status_code == 409
        assert pagar_todo.status_code == 200, pagar_todo.text

        lista = (await c.get("/api/finanzas/deudas/", headers=h)).json()
        # Activas primero: el préstamo sigue activo y el crédito quedó pagado.
        assert [(d["id_deuda"], d["estado"]) for d in lista["items"]] == [(id_prestamo, "activa"), (id_credito, "pagada")]
        assert lista["total_debo"] == 0 and lista["total_me_deben"] == 30000
        pagadas = (await c.get("/api/finanzas/deudas/", headers=h, params={"estado": "pagada"})).json()
        assert [d["id_deuda"] for d in pagadas["items"]] == [id_credito]

        otro_abono = await c.post("/api/finanzas/movimientos/", headers=h, json=movimiento(1, id_deuda=id_credito))
        assert otro_abono.status_code == 409 and "ya está pagada" in otro_abono.json()["detail"]

        menor_a_abonado = await c.patch(f"/api/finanzas/deudas/{id_credito}", headers=h, json={"monto_total": 90000})
        con_intereses = await c.patch(f"/api/finanzas/deudas/{id_credito}", headers=h, json={"monto_total": 120000})
        nombre_nulo = await c.patch(f"/api/finanzas/deudas/{id_credito}", headers=h, json={"nombre": None})
        assert menor_a_abonado.status_code == 409
        assert con_intereses.json()["saldo"] == 20000 and con_intereses.json()["estado"] == "activa"
        assert nombre_nulo.status_code == 422

        abonos = await c.get("/api/finanzas/movimientos/", headers=h, params={"id_deuda": id_credito})
        assert [m["id_transaccion"] for m in abonos.json()["items"]] == [id_abono]

        desvinculado = await c.patch(f"/api/finanzas/movimientos/{id_abono}", headers=h, json={"id_deuda": None})
        assert desvinculado.json()["id_deuda"] is None
        assert (await c.get(f"/api/finanzas/deudas/{id_credito}", headers=h)).json()["abonado"] == 0

        # Borrar una deuda deja sus abonos como movimientos normales.
        borrada = await c.delete(f"/api/finanzas/deudas/{id_prestamo}", headers=h)
        assert borrada.status_code == 204
        assert (await c.get(f"/api/finanzas/deudas/{id_prestamo}", headers=h)).status_code == 404
        sigue = await c.get(f"/api/finanzas/movimientos/{cobro.json()['id_transaccion']}", headers=h)
        assert sigue.status_code == 200 and sigue.json()["id_deuda"] is None
