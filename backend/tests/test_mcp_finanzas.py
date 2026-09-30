"""Servidor MCP de finanzas: auth por API key, permisos por herramienta y lectura/escritura.

Los tests de auth sin credencial no tocan la BD. El resto es integracion HTTP + PostgreSQL
con el cliente MCP del SDK; como los de test_finanzas_movimientos_db.py, solo corren con
RUN_DB_TESTS=1 y un DATABASE_URL cuya base termine en "_test".
"""
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime

import httpx
import httpx2
import pytest
from mcp import Client
from mcp.client.streamable_http import streamable_http_client

from app.main import app
from app.mcp.server import MCP_PATH, crear_app_mcp, crear_servidor_mcp

DB_URL = os.environ.get("DATABASE_URL", "")
RUN_DB = os.environ.get("RUN_DB_TESTS") == "1" and DB_URL.rsplit("/", 1)[-1].endswith("_test")
requiere_db = pytest.mark.skipif(not RUN_DB, reason="Requiere RUN_DB_TESTS=1 y una base *_test.")
pytestmark = pytest.mark.asyncio(loop_scope="session")

LECTURA = {
    "listar_cuentas",
    "listar_categorias",
    "buscar_movimientos",
    "buscar_productos",
    "resumen_mes",
    "tendencia_mensual",
    "distribucion_por_categoria",
    "distribucion_por_cuenta",
    "gasto_diario",
    "listar_deudas",
    "previsualizar_importacion",
    "listar_importaciones",
}
ESCRITURA = {
    "registrar_movimiento",
    "editar_movimiento",
    "eliminar_movimiento",
    "crear_categoria",
    "crear_producto",
    "agregar_producto_a_gasto",
    "quitar_producto_de_gasto",
    "crear_deuda",
    "editar_deuda",
    "eliminar_deuda",
    "importar_movimientos",
    "deshacer_importacion",
}


@asynccontextmanager
async def cliente_mcp(api_key: str):
    # Servidor nuevo por test: el session manager solo puede arrancar una vez por instancia.
    servidor = crear_servidor_mcp()
    app_mcp = crear_app_mcp(servidor)
    http = httpx2.AsyncClient(
        transport=httpx2.ASGITransport(app=app_mcp),
        headers={"Authorization": f"Bearer {api_key}"},
    )
    async with servidor.session_manager.run(), http:
        async with Client(streamable_http_client(f"http://test{MCP_PATH}", http_client=http)) as cliente:
            yield cliente


async def test_endpoint_montado_en_la_app_exige_api_key():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(MCP_PATH, json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"})

    assert r.status_code == 401
    assert r.json()["detail"] == "Credenciales requeridas."
    assert r.headers["www-authenticate"].startswith("Bearer")


async def test_bearer_que_no_es_bearer_no_cuenta_como_api_key():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(MCP_PATH, headers={"Authorization": "Basic abc"}, json={})

    assert r.status_code == 401


if RUN_DB:
    from sqlalchemy import delete, select, update

    from app.auth.api_key import generate_api_key
    from app.db.session import AsyncSessionLocal, engine
    from app.models import (
        ApiKey, Banco, CategoriaFinanza, CuentaUsuario, Importacion, Movimiento, Producto, ProductoFinanciero, Usuario,
    )
    from app.models.finanzas import EnumTipoGasto, EnumTipoMovimiento
    from app.models.usuario_auth import User


@pytest.fixture
async def escenario():
    """Usuario A con dos cuentas activas y una inactiva; usuario B con un gasto propio."""
    sufijo = uuid.uuid4().hex[:8]
    async with AsyncSessionLocal() as db:
        auth_a = User(email=f"mcp-a-{sufijo}@example.com", hashed_password="x", is_active=True)
        auth_b = User(email=f"mcp-b-{sufijo}@example.com", hashed_password="x", is_active=True)
        db.add_all([auth_a, auth_b])
        await db.flush()
        perfil_a = Usuario(
            username=f"ma{sufijo}", nombre="A", apellido="Mcp", telefono=f"1{sufijo[:7]}",
            email=auth_a.email, auth_user_id=auth_a.id,
        )
        perfil_b = Usuario(
            username=f"mb{sufijo}", nombre="B", apellido="Mcp", telefono=f"2{sufijo[:7]}",
            email=auth_b.email, auth_user_id=auth_b.id,
        )
        banco = Banco(nombre_banco=f"Banco MCP {sufijo}")
        db.add_all([perfil_a, perfil_b, banco])
        await db.flush()
        producto = ProductoFinanciero(id_banco=banco.id_banco, nombre_producto="Cuenta Vista")
        comida = CategoriaFinanza(nombre=f"comida-mcp-{sufijo}")
        salud = CategoriaFinanza(nombre=f"salud-mcp-{sufijo}")
        db.add_all([producto, comida, salud])
        await db.flush()

        def cuenta(perfil, nombre, activo=True):
            return CuentaUsuario(
                id_usuario=perfil.id_usuario, id_producto_financiero=producto.id_producto_financiero,
                nombre_cuenta=nombre, activo=activo,
            )

        rut, tc, vieja = cuenta(perfil_a, "RUT"), cuenta(perfil_a, "TC"), cuenta(perfil_a, "Vieja", activo=False)
        ajena = cuenta(perfil_b, "Ajena")
        db.add_all([rut, tc, vieja, ajena])
        await db.flush()

        def mov(cuenta, categoria, monto, fecha, tipo=EnumTipoMovimiento.GASTO, tipo_gasto=EnumTipoGasto.VARIABLE,
                descripcion=None):
            return Movimiento(
                id_cuenta=cuenta.id_cuenta, id_categoria=categoria.id_categoria, tipo_movimiento=tipo,
                tipo_gasto=tipo_gasto, monto=monto, created_at=fecha, descripcion=descripcion,
                en_lugar_compra=False,
            )

        db.add_all([
            mov(rut, comida, 8500, datetime(2026, 9, 25, 13, 0), descripcion="Almuerzo"),
            mov(tc, salud, 18990, datetime(2026, 9, 22, 19, 0), descripcion="Farmacia del barrio"),
            mov(rut, comida, 50000, datetime(2026, 9, 5, 9, 0), tipo_gasto=EnumTipoGasto.FIJO, descripcion="Arriendo"),
            mov(rut, comida, 850000, datetime(2026, 9, 1, 9, 0), tipo=EnumTipoMovimiento.INGRESO),
            mov(rut, comida, 40000, datetime(2026, 8, 30, 20, 0)),
            mov(ajena, comida, 99999, datetime(2026, 9, 10, 12, 0), descripcion="Farmacia ajena"),
        ])

        keys = {}
        for nombre, scopes, activo in (
            ("lectura", ["finanzas:read"], True),
            ("escritura", ["finanzas:write"], True),
            ("revocada", ["*"], False),
        ):
            valor, prefijo, key_hash = generate_api_key()
            db.add(ApiKey(
                auth_user_id=auth_a.id, nombre=nombre, key_prefix=prefijo, key_hash=key_hash,
                scopes=scopes, activo=activo,
            ))
            keys[nombre] = valor
        await db.commit()
        datos = {
            "key": keys["lectura"], "key_escritura": keys["escritura"], "key_revocada": keys["revocada"],
            "auth_ids": [auth_a.id, auth_b.id],
            "perfiles": [perfil_a.id_usuario, perfil_b.id_usuario],
            "cuentas": [rut.id_cuenta, tc.id_cuenta, vieja.id_cuenta, ajena.id_cuenta],
            "rut": rut.id_cuenta, "tc": tc.id_cuenta, "ajena": ajena.id_cuenta,
            "categorias": [comida.id_categoria, salud.id_categoria], "salud": salud.id_categoria,
            "comida": comida.id_categoria,
            "banco": banco.id_banco, "producto": producto.id_producto_financiero,
        }

    yield datos

    async with AsyncSessionLocal() as db:
        await db.execute(delete(Movimiento).where(Movimiento.id_cuenta.in_(datos["cuentas"])))
        await db.execute(delete(Importacion).where(Importacion.id_cuenta.in_(datos["cuentas"])))
        await db.execute(delete(CuentaUsuario).where(CuentaUsuario.id_cuenta.in_(datos["cuentas"])))
        await db.execute(delete(CategoriaFinanza).where(CategoriaFinanza.id_categoria.in_(datos["categorias"])))
        await db.execute(delete(ProductoFinanciero).where(ProductoFinanciero.id_producto_financiero == datos["producto"]))
        await db.execute(delete(Banco).where(Banco.id_banco == datos["banco"]))
        await db.execute(delete(ApiKey).where(ApiKey.auth_user_id.in_(datos["auth_ids"])))
        await db.execute(delete(Usuario).where(Usuario.id_usuario.in_(datos["perfiles"])))
        await db.execute(delete(User).where(User.id.in_(datos["auth_ids"])))
        await db.commit()
    await engine.dispose()


@requiere_db
async def test_key_revocada_o_inventada_da_401(escenario):
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
        revocada = await c.post(MCP_PATH, headers={"X-API-Key": escenario["key_revocada"]}, json={})
        inventada = await c.post(MCP_PATH, headers={"Authorization": "Bearer thw_no-existe"}, json={})

    assert revocada.status_code == 401
    assert inventada.status_code == 401


@requiere_db
async def test_herramientas_marcan_lectura_y_escritura(escenario):
    async with cliente_mcp(escenario["key"]) as cliente:
        herramientas = {h.name: h for h in (await cliente.list_tools()).tools}
        instrucciones = cliente.instructions

    assert set(herramientas) == LECTURA | ESCRITURA
    assert all(herramientas[nombre].annotations.read_only_hint for nombre in LECTURA)
    assert not any(herramientas[nombre].annotations.read_only_hint for nombre in ESCRITURA)
    assert herramientas["eliminar_movimiento"].annotations.destructive_hint
    assert "CLP" in instrucciones


@requiere_db
async def test_listar_cuentas_omite_inactivas_y_ajenas(escenario):
    async with cliente_mcp(escenario["key"]) as cliente:
        resultado = await cliente.call_tool("listar_cuentas", {})

    assert not resultado.is_error
    nombres = {c["nombre_cuenta"] for c in resultado.structured_content["items"]}
    assert nombres == {"RUT", "TC"}


@requiere_db
async def test_buscar_movimientos_filtra_pagina_y_aisla_usuarios(escenario):
    async with cliente_mcp(escenario["key"]) as cliente:
        septiembre = await cliente.call_tool("buscar_movimientos", {"year": 2026, "month": 9, "limit": 2})
        farmacia = await cliente.call_tool("buscar_movimientos", {"texto": "farmacia"})
        salud = await cliente.call_tool("buscar_movimientos", {"id_categoria": escenario["salud"]})
        ingresos = await cliente.call_tool("buscar_movimientos", {"tipo_movimiento": "ingreso"})
        invalido = await cliente.call_tool("buscar_movimientos", {"limit": 500})

    pagina = septiembre.structured_content
    assert [m["monto"] for m in pagina["items"]] == [8500, 18990]
    assert pagina["hay_mas"] is True
    # La "Farmacia ajena" es de otro usuario: no aparece.
    assert [m["descripcion"] for m in farmacia.structured_content["items"]] == ["Farmacia del barrio"]
    assert farmacia.structured_content["items"][0]["cuenta"] == "TC"
    assert [m["monto"] for m in salud.structured_content["items"]] == [18990]
    assert [m["monto"] for m in ingresos.structured_content["items"]] == [850000]
    assert invalido.is_error


@requiere_db
async def test_analitica_del_mes(escenario):
    periodo = {"year": 2026, "month": 9}
    async with cliente_mcp(escenario["key"]) as cliente:
        resumen = (await cliente.call_tool("resumen_mes", periodo)).structured_content
        categorias = (await cliente.call_tool("distribucion_por_categoria", periodo)).structured_content
        cuentas = (await cliente.call_tool("distribucion_por_cuenta", periodo)).structured_content
        diario = (await cliente.call_tool("gasto_diario", periodo)).structured_content

    assert resumen["gasto_total"] == 8500 + 18990 + 50000
    assert resumen["ingreso_total"] == 850000
    assert resumen["gasto_fijo_total"] == 50000
    assert resumen["variacion_gasto_vs_mes_anterior"] == (8500 + 18990 + 50000) - 40000
    assert [item["total"] for item in categorias["items"]] == [58500, 18990]
    assert {item["nombre_cuenta"]: item["total"] for item in cuentas["items"]} == {"RUT": 58500, "TC": 18990}
    assert diario["dia_mayor_gasto"]["dia"] == 5
    assert len(diario["items"]) == 30


@requiere_db
async def test_key_de_lectura_no_puede_escribir(escenario):
    async with cliente_mcp(escenario["key"]) as cliente:
        resultado = await cliente.call_tool("registrar_movimiento", {
            "tipo_movimiento": "gasto", "monto": 1000,
            "id_categoria": escenario["comida"], "id_cuenta": escenario["rut"],
        })
        despues = await cliente.call_tool("buscar_movimientos", {"texto": "Almuerzo"})

    assert resultado.is_error
    assert "finanzas:write" in resultado.content[0].text
    assert len(despues.structured_content["items"]) == 1


@requiere_db
async def test_registrar_editar_y_eliminar_movimiento(escenario):
    id_solicitud = str(uuid.uuid4())
    nuevo = {
        "tipo_movimiento": "gasto", "monto": 5990, "id_categoria": escenario["comida"],
        "id_cuenta": escenario["tc"], "descripcion": "Cafe MCP",
        "fecha": "2026-09-27T16:30:00Z", "client_request_id": id_solicitud,
    }
    async with cliente_mcp(escenario["key_escritura"]) as cliente:
        creado = await cliente.call_tool("registrar_movimiento", nuevo)
        reintento = await cliente.call_tool("registrar_movimiento", nuevo)
        id_mov = creado.structured_content["id_movimiento"]
        editado = await cliente.call_tool(
            "editar_movimiento", {"id_movimiento": id_mov, "monto": 6500, "descripcion": ""}
        )
        sin_cambios = await cliente.call_tool("editar_movimiento", {"id_movimiento": id_mov})
        eliminado = await cliente.call_tool("eliminar_movimiento", {"id_movimiento": id_mov})
        otra_vez = await cliente.call_tool("eliminar_movimiento", {"id_movimiento": id_mov})

    assert not creado.is_error, creado.content
    movimiento = creado.structured_content
    assert movimiento["cuenta"] == "TC" and movimiento["monto"] == 5990
    # 16:30 UTC son las 13:30 en Chile (UTC-3 en septiembre).
    assert movimiento["fecha"].startswith("2026-09-27T13:30")
    # El mismo client_request_id devuelve el movimiento ya creado, no uno nuevo.
    assert reintento.structured_content["id_movimiento"] == id_mov
    assert editado.structured_content["monto"] == 6500
    assert editado.structured_content["descripcion"] is None
    assert sin_cambios.is_error
    assert eliminado.structured_content == {"id_movimiento": id_mov, "eliminado": True}
    assert otra_vez.is_error
    assert "no encontrado" in otra_vez.content[0].text


@requiere_db
async def test_escritura_no_toca_datos_de_otro_usuario(escenario):
    async with cliente_mcp(escenario["key_escritura"]) as cliente:
        en_cuenta_ajena = await cliente.call_tool("registrar_movimiento", {
            "tipo_movimiento": "gasto", "monto": 1000,
            "id_categoria": escenario["comida"], "id_cuenta": escenario["ajena"],
        })
        ajeno = (await cliente.call_tool("buscar_movimientos", {"id_cuenta": escenario["ajena"]}))
        monto_invalido = await cliente.call_tool("registrar_movimiento", {
            "tipo_movimiento": "gasto", "monto": -5,
            "id_categoria": escenario["comida"], "id_cuenta": escenario["rut"],
        })

    assert en_cuenta_ajena.is_error
    assert "Cuenta no encontrada" in en_cuenta_ajena.content[0].text
    assert ajeno.structured_content["items"] == []
    assert monto_invalido.is_error


@requiere_db
async def test_categoria_propia_y_productos_en_un_gasto(escenario):
    sufijo = uuid.uuid4().hex[:6]
    async with cliente_mcp(escenario["key_escritura"]) as cliente:
        categoria = await cliente.call_tool("crear_categoria", {"nombre": f"Mascotas {sufijo}"})
        repetida = await cliente.call_tool("crear_categoria", {"nombre": f"mascotas {sufijo}"})
        listadas = await cliente.call_tool("listar_categorias", {})
        gasto = await cliente.call_tool("registrar_movimiento", {
            "tipo_movimiento": "gasto", "monto": 4500,
            "id_categoria": categoria.structured_content["id_categoria"], "id_cuenta": escenario["rut"],
        })
        datos_producto = {"nombre": f"Alimento gato {sufijo}", "contenido_neto": 1.5, "unidad_contenido": "kg"}
        # Solo un administrador agrega productos al catalogo.
        sin_permiso = await cliente.call_tool("crear_producto", datos_producto)
        async with AsyncSessionLocal() as db:
            await db.execute(update(User).where(User.id == escenario["auth_ids"][0]).values(is_superuser=True))
            await db.commit()
        producto = await cliente.call_tool("crear_producto", datos_producto)
        encontrados = await cliente.call_tool("buscar_productos", {"texto": f"gato {sufijo}"})
        id_mov = gasto.structured_content["id_movimiento"]
        con_producto = await cliente.call_tool("agregar_producto_a_gasto", {
            "id_movimiento": id_mov,
            "id_producto": producto.structured_content["id_producto"],
            "cantidad": 1, "precio_total": 4500,
        })
        frecuentes = await cliente.call_tool("buscar_productos", {})
        id_item = con_producto.structured_content["productos"][0]["id_item"]
        sin_producto = await cliente.call_tool("quitar_producto_de_gasto", {"id_movimiento": id_mov, "id_item": id_item})

    try:
        assert not categoria.is_error, categoria.content
        assert categoria.structured_content["es_propia"] is True
        assert repetida.is_error
        nombres = {c["nombre"] for c in listadas.structured_content["items"]}
        assert f"Mascotas {sufijo}" in nombres
        assert sin_permiso.is_error
        assert producto.structured_content["estado"] == "aprobado"
        assert producto.structured_content["contenido"] == "1.5 kg"
        assert [p["id_producto"] for p in encontrados.structured_content["items"]] == [
            producto.structured_content["id_producto"]
        ]
        assert con_producto.structured_content["productos"][0]["precio_total"] == 4500
        assert producto.structured_content["id_producto"] in {
            p["id_producto"] for p in frecuentes.structured_content["items"]
        }
        assert sin_producto.structured_content["productos"] == []
    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(Movimiento).where(Movimiento.id_transaccion == id_mov))
            await db.execute(
                delete(Producto).where(Producto.id_producto == producto.structured_content["id_producto"])
            )
            await db.commit()


@requiere_db
async def test_deudas_por_mcp(escenario):
    async with cliente_mcp(escenario["key_escritura"]) as cliente:
        deuda = await cliente.call_tool("crear_deuda", {
            "tipo": "debo", "nombre": "Notebook en cuotas", "monto_total": 60000, "contraparte": "Tienda",
        })
        id_deuda = deuda.structured_content["id_deuda"]
        abono = await cliente.call_tool("registrar_movimiento", {
            "tipo_movimiento": "gasto", "monto": 20000, "id_categoria": escenario["comida"],
            "id_cuenta": escenario["rut"], "id_deuda": id_deuda,
        })
        excede = await cliente.call_tool("registrar_movimiento", {
            "tipo_movimiento": "gasto", "monto": 50000, "id_categoria": escenario["comida"],
            "id_cuenta": escenario["rut"], "id_deuda": id_deuda,
        })
        lista = await cliente.call_tool("listar_deudas", {"estado": "activa"})
        abonos = await cliente.call_tool("buscar_movimientos", {"id_deuda": id_deuda})
        id_abono = abono.structured_content["id_movimiento"]
        sin_deuda = await cliente.call_tool("editar_movimiento", {"id_movimiento": id_abono, "quitar_deuda": True})
        editada = await cliente.call_tool("editar_deuda", {"id_deuda": id_deuda, "contraparte": ""})
        eliminada = await cliente.call_tool("eliminar_deuda", {"id_deuda": id_deuda})

    assert not abono.is_error, abono.content
    assert abono.structured_content["deuda"] == "Notebook en cuotas"
    assert excede.is_error and "supera el saldo" in excede.content[0].text
    [item] = lista.structured_content["items"]
    assert (item["abonado"], item["saldo"]) == (20000, 40000)
    assert lista.structured_content["total_debo"] == 40000
    assert [m["id_movimiento"] for m in abonos.structured_content["items"]] == [id_abono]
    assert sin_deuda.structured_content["id_deuda"] is None
    assert editada.structured_content["contraparte"] is None
    assert editada.structured_content["saldo"] == 60000
    assert eliminada.structured_content == {"id_deuda": id_deuda, "eliminada": True}


@requiere_db
async def test_importar_cartola_omite_duplicados_y_se_puede_deshacer(escenario):
    comida = escenario["comida"]

    def fila(fecha, glosa, monto, tipo="gasto", **extra):
        return {
            "fecha": fecha, "descripcion_original": glosa, "monto": monto,
            "tipo_movimiento": tipo, "id_categoria": comida, **extra,
        }

    cartola = [
        # Parecido al "Almuerzo" de 8.500 registrado a mano el 25-09 en la misma cuenta.
        fila("2026-09-26", "COMPRA NAC RESTAURANT", 8500, descripcion="Restaurant"),
        # Dos pasajes identicos el mismo dia son dos movimientos distintos.
        fila("2026-09-10", "PASAJE METRO", 800),
        fila("2026-09-10", "PASAJE  metro", 800),
        # El ingreso manual del 01-09 esta a mas de 3 dias: no es duplicado.
        fila("2026-09-15T09:00:00", "TRANSF DE EMPLEADOR", 850000, "ingreso"),
    ]
    invalida = fila("2026-09-11", "OTRA", 1000)
    invalida["id_categoria"] = 999999999

    async with cliente_mcp(escenario["key_escritura"]) as cliente:
        previa = await cliente.call_tool("previsualizar_importacion", {
            "id_cuenta": escenario["rut"], "filas": [*cartola, invalida],
        })
        rechazada = await cliente.call_tool("importar_movimientos", {
            "id_cuenta": escenario["rut"], "filas": [*cartola, invalida],
        })
        metro_antes = await cliente.call_tool("buscar_movimientos", {"texto": "metro"})
        primera = await cliente.call_tool("importar_movimientos", {
            "id_cuenta": escenario["rut"], "filas": cartola, "nombre": "Cartola sept",
        })
        repetida = await cliente.call_tool("importar_movimientos", {"id_cuenta": escenario["rut"], "filas": cartola})
        confirmada = await cliente.call_tool("importar_movimientos", {
            "id_cuenta": escenario["rut"], "filas": cartola, "confirmar_duplicados": [0],
        })
        en_cuenta_ajena = await cliente.call_tool("previsualizar_importacion", {
            "id_cuenta": escenario["ajena"], "filas": cartola,
        })
        importaciones = await cliente.call_tool("listar_importaciones", {})
        deshecha = await cliente.call_tool("deshacer_importacion", {
            "id_importacion": primera.structured_content["id_importacion"],
        })
        metro_despues = await cliente.call_tool("buscar_movimientos", {"texto": "metro"})
        restaurant = await cliente.call_tool("buscar_movimientos", {"texto": "restaurant"})

    assert not previa.is_error, previa.content
    resumen = previa.structured_content
    assert (resumen["nuevas"], resumen["posibles_duplicados"], resumen["invalidas"]) == (3, 1, 1)
    assert resumen["total_gastos"] == 1600 and resumen["total_ingresos"] == 850000
    estados = {f["indice"]: f for f in resumen["filas"]}
    assert estados[0]["estado"] == "posible_duplicado" and estados[0]["coincidencias"]
    assert estados[4]["estado"] == "invalida" and "Categoría" in estados[4]["detalle"]

    assert rechazada.is_error and "fila 4" in rechazada.content[0].text
    assert metro_antes.structured_content["items"] == []

    assert not primera.is_error, primera.content
    assert (primera.structured_content["creados"], primera.structured_content["omitidos_posibles_duplicados"]) == (3, 1)
    assert repetida.structured_content["creados"] == 0
    assert repetida.structured_content["omitidos_ya_importados"] == 3
    assert repetida.structured_content["id_importacion"] is None
    assert confirmada.structured_content["creados"] == 1

    assert en_cuenta_ajena.is_error and "Cuenta no encontrada" in en_cuenta_ajena.content[0].text
    nombres = [i["nombre"] for i in importaciones.structured_content["items"]]
    assert nombres == [None, "Cartola sept"]
    assert importaciones.structured_content["items"][1]["fecha_desde"].startswith("2026-09-10")

    assert deshecha.structured_content["movimientos_eliminados"] == 3
    assert metro_despues.structured_content["items"] == []
    # La fila confirmada vino en otra importacion: sigue ahi, con la descripcion legible.
    assert [m["descripcion"] for m in restaurant.structured_content["items"]] == ["Restaurant"]


@requiere_db
async def test_importar_abonos_no_supera_el_saldo_de_la_deuda(escenario):
    async with cliente_mcp(escenario["key_escritura"]) as cliente:
        deuda = await cliente.call_tool("crear_deuda", {"tipo": "debo", "nombre": "Credito", "monto_total": 10000})
        id_deuda = deuda.structured_content["id_deuda"]
        filas = [
            {"fecha": f"2026-09-{dia}", "descripcion_original": f"PAGO CREDITO {dia}", "monto": 6000,
             "tipo_movimiento": "gasto", "id_categoria": escenario["comida"], "id_deuda": id_deuda}
            for dia in (12, 13)
        ]
        previa = await cliente.call_tool("previsualizar_importacion", {"id_cuenta": escenario["rut"], "filas": filas})
        solo_una = await cliente.call_tool("importar_movimientos", {"id_cuenta": escenario["rut"], "filas": filas[:1]})
        deudas = await cliente.call_tool("listar_deudas", {})

    [invalida] = previa.structured_content["filas"]
    # La segunda cuota junta 12.000 contra un total de 10.000.
    assert invalida["indice"] == 1 and "supera el saldo" in invalida["detalle"]
    assert solo_una.structured_content["creados"] == 1
    assert deudas.structured_content["items"][0]["saldo"] == 4000
