"""Integración PostgreSQL de las comidas con sus alimentos y calorías.

Solo corre con RUN_DB_TESTS=1 y una base *_test (ver test_finanzas_movimientos_db.py).
"""
import os
import uuid
from datetime import date

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

    from app.auth.api_key import generate_api_key
    from app.auth.fastapi_users import current_superuser, current_user_or_api_key
    from app.db.session import AsyncSessionLocal
    from app.main import app
    from app.models import ApiKey, Consumo, ConsumoDetalle, MetaNutricional, Producto, TablaNutricional, Usuario
    from app.models.usuario_auth import User
    from tests.test_mcp_finanzas import cliente_mcp


@pytest.fixture
async def escenario():
    sufijo = uuid.uuid4().hex[:8]
    async with AsyncSessionLocal() as db:
        auth = User(email=f"nutricion-{sufijo}@example.com", hashed_password="x", is_active=True)
        db.add(auth)
        await db.flush()
        usuario = Usuario(
            username=f"n{sufijo}", nombre="Test", apellido="Nutricion", telefono=sufijo[:8],
            email=auth.email, auth_user_id=auth.id,
        )
        codigo = str(uuid.uuid4().int)[:13]
        yogur = Producto(
            nombre_producto=f"Yogur {sufijo}", contenido_neto=125, unidad_contenido="g",
            codigo_barra=codigo, estado="aprobado",
        )
        codigo_sin_tabla = str(uuid.uuid4().int)[:13]
        sin_tabla = Producto(
            nombre_producto=f"Sin tabla {sufijo}", codigo_barra=codigo_sin_tabla, estado="aprobado",
            contenido_neto=500, unidad_contenido="ml",
        )
        db.add_all([usuario, yogur, sin_tabla])
        await db.flush()
        db.add_all([
            # La vieja no debe usarse: manda la más reciente.
            TablaNutricional(id_producto=yogur.id_producto, porcion_cantidad=100, porcion_unidad="g", calorias=999),
            TablaNutricional(
                id_producto=yogur.id_producto, porcion_cantidad=100, porcion_unidad="g",
                calorias=80, proteinas=4, carbohidratos=12, grasas=2,
            ),
        ])
        db.add(MetaNutricional(id_usuario=usuario.id_usuario, fecha_inicio=date(2026, 1, 1), calorias_objetivo=2000))
        keys = {}
        for nombre, scopes in (("lectura", ["nutricion:read"]), ("escritura", ["nutricion:write"]), ("finanzas", ["finanzas:write"])):
            valor, prefijo, key_hash = generate_api_key()
            db.add(ApiKey(auth_user_id=auth.id, nombre=nombre, key_prefix=prefijo, key_hash=key_hash, scopes=scopes))
            keys[nombre] = valor
        await db.commit()
        ids = {"keys": keys, "auth": auth, "usuario": usuario.id_usuario, "yogur": yogur.id_producto, "sin_tabla": sin_tabla.id_producto, "codigo": codigo, "codigo_sin_tabla": codigo_sin_tabla}

    app.dependency_overrides[current_user_or_api_key] = lambda: ids["auth"]
    yield ids
    app.dependency_overrides.clear()

    async with AsyncSessionLocal() as db:
        comidas = select(Consumo.id_consumo).where(Consumo.id_usuario == ids["usuario"])
        await db.execute(delete(ConsumoDetalle).where(ConsumoDetalle.id_consumo.in_(comidas)))
        await db.execute(delete(Consumo).where(Consumo.id_usuario == ids["usuario"]))
        productos = [ids["yogur"], ids["sin_tabla"]]
        await db.execute(delete(TablaNutricional).where(TablaNutricional.id_producto.in_(productos)))
        await db.execute(delete(Producto).where(Producto.id_producto.in_(productos)))
        await db.execute(delete(MetaNutricional).where(MetaNutricional.id_usuario == ids["usuario"]))
        await db.execute(delete(ApiKey).where(ApiKey.auth_user_id == ids["auth"].id))
        await db.execute(delete(Usuario).where(Usuario.id_usuario == ids["usuario"]))
        await db.execute(delete(User).where(User.id == ids["auth"].id))
        await db.commit()


def cliente():
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")


async def test_comida_con_producto_y_alimento_libre_suma_calorias(escenario):
    async with cliente() as c:
        r = await c.post("/api/nutricion/consumo/", json={
            "fecha_consumo": "2026-11-16T13:30:00",
            "tipo_comida": "almuerzo",
            "detalles": [
                {"id_producto": escenario["yogur"], "cantidad_consumida": 2, "unidad_consumida": "unidad"},
                {
                    "nombre_alimento": "Pastel de choclo", "cantidad_consumida": 1, "unidad_consumida": "porcion",
                    "calorias": 650, "proteinas": 30, "estimado": True,
                },
                {"id_producto": escenario["sin_tabla"], "cantidad_consumida": 1, "unidad_consumida": "unidad"},
            ],
        })
        assert r.status_code == 201, r.text
        comida = r.json()
        yogur, pastel, sin_tabla = comida["detalles"]
        # 2 yogures de 125 g con la tabla vigente de 80 kcal / 100 g.
        assert yogur["calorias"] == 200.0 and yogur["proteinas"] == 10.0 and yogur["nombre"].startswith("Yogur")
        assert pastel["calorias"] == 650.0 and pastel["estimado"] is True and pastel["nombre"] == "Pastel de choclo"
        assert sin_tabla["calorias"] is None
        assert comida["total_calorias"] == 850.0
        assert comida["total_proteinas"] == 40.0

        listado = (await c.get("/api/nutricion/consumo/")).json()
        assert listado[0]["id_consumo"] == comida["id_consumo"] and listado[0]["total_calorias"] == 850.0


async def test_editar_cantidad_recalcula_y_agregar_linea(escenario):
    async with cliente() as c:
        comida = (await c.post("/api/nutricion/consumo/", json={
            "fecha_consumo": "2026-11-16T08:00:00", "tipo_comida": "desayuno",
        })).json()
        assert comida["detalles"] == [] and comida["total_calorias"] is None

        linea = await c.post("/api/nutricion/consumo-detalle/", json={
            "id_consumo": comida["id_consumo"], "id_producto": escenario["yogur"],
            "cantidad_consumida": 150, "unidad_consumida": "g",
        })
        assert linea.status_code == 201, linea.text
        assert linea.json()["calorias"] == 120.0

        editada = await c.patch(f"/api/nutricion/consumo-detalle/{linea.json()['id_consumo_detalle']}", json={
            "cantidad_consumida": 300,
        })
        assert editada.status_code == 200, editada.text
        assert editada.json()["calorias"] == 240.0

        total = (await c.get(f"/api/nutricion/consumo/{comida['id_consumo']}")).json()
        assert total["total_calorias"] == 240.0


async def test_alimento_libre_sin_calorias_se_rechaza(escenario):
    async with cliente() as c:
        r = await c.post("/api/nutricion/consumo/", json={
            "fecha_consumo": "2026-11-16T20:00:00", "tipo_comida": "cena",
            "detalles": [{"nombre_alimento": "Pan", "cantidad_consumida": 1, "unidad_consumida": "unidad"}],
        })
        assert r.status_code == 422


async def test_codigo_de_barras_del_catalogo_trae_su_tabla_vigente(escenario, monkeypatch):
    from app.services.nutricion import codigo_barra

    async def no_consultar(_codigo):
        raise AssertionError("Con el producto en el catálogo no se consulta Open Food Facts")

    monkeypatch.setattr(codigo_barra, "consultar_open_food_facts", no_consultar)
    async with cliente() as c:
        r = await c.get(f"/api/nutricion/codigo-barra/{escenario['codigo']}")
        assert r.status_code == 200, r.text
        assert r.json()["origen"] == "catalogo" and r.json()["id_producto"] == escenario["yogur"]
        assert r.json()["calorias"] == 80.0 and r.json()["contenido_neto"] == 125.0


async def test_codigo_desconocido_cae_en_open_food_facts(escenario, monkeypatch):
    from app.services.nutricion import codigo_barra

    async def falso(codigo):
        if codigo == "0000000000017":
            return {"status": 1, "product": {"product_name": "Barra", "nutriments": {"energy-kcal_100g": 400}}}
        return None

    monkeypatch.setattr(codigo_barra, "consultar_open_food_facts", falso)
    async with cliente() as c:
        r = await c.get("/api/nutricion/codigo-barra/0000000000017")
        assert r.status_code == 200, r.text
        assert r.json()["origen"] == "openfoodfacts" and r.json()["id_producto"] is None
        assert (await c.get("/api/nutricion/codigo-barra/0000000000024")).status_code == 404
        assert (await c.get("/api/nutricion/codigo-barra/12")).status_code == 400


async def test_foto_de_un_plato_por_mcp(escenario):
    plato = {
        "tipo_comida": "almuerzo",
        "fecha_hora": "2026-11-16T13:30:00-03:00",
        "alimentos": [
            {"nombre_alimento": "Arroz blanco", "cantidad": 150, "unidad": "g", "calorias": 195, "carbohidratos": 42, "estimado": True},
            {"nombre_alimento": "Pechuga de pollo a la plancha", "cantidad": 120, "unidad": "g", "calorias": 198, "proteinas": 37, "estimado": True},
            {"id_producto": escenario["yogur"], "cantidad": 1, "unidad": "unidad"},
        ],
    }
    async with cliente_mcp(escenario["keys"]["finanzas"]) as cliente:
        sin_permiso = await cliente.call_tool("resumen_nutricion_dia", {"fecha": "2026-11-16"})
    async with cliente_mcp(escenario["keys"]["lectura"]) as cliente:
        solo_lectura = await cliente.call_tool("registrar_comida", plato)
        busqueda = await cliente.call_tool("buscar_alimentos", {"texto": escenario["codigo"]})
    async with cliente_mcp(escenario["keys"]["escritura"]) as cliente:
        libre_sin_kcal = await cliente.call_tool("registrar_comida", {
            "tipo_comida": "cena", "alimentos": [{"nombre_alimento": "Pan", "cantidad": 1, "unidad": "unidad"}],
        })
        registrada = await cliente.call_tool("registrar_comida", plato)
        resumen = await cliente.call_tool("resumen_nutricion_dia", {"fecha": "2026-11-16"})
        tendencia = await cliente.call_tool("tendencia_calorias", {"dias": 3, "hasta": "2026-11-17"})

    assert sin_permiso.is_error and solo_lectura.is_error
    assert not busqueda.is_error, busqueda.content
    encontrado = busqueda.structured_content["alimentos"][0]
    assert encontrado["id_producto"] == escenario["yogur"] and encontrado["tiene_tabla"] is True
    assert libre_sin_kcal.is_error

    assert not registrada.is_error, registrada.content
    comida = registrada.structured_content
    # 195 + 198 + 1 yogur de 125 g a 80 kcal/100 g.
    assert comida["total_calorias"] == 493.0
    assert [d["estimado"] for d in comida["detalles"]] == [True, True, False]

    assert not resumen.is_error, resumen.content
    dia = resumen.structured_content
    assert dia["calorias"] == 493.0 and dia["cantidad_comidas"] == 1
    assert dia["meta"]["calorias_objetivo"] == 2000 and dia["calorias_restantes"] == 1507.0

    dias = tendencia.structured_content["dias"]
    assert [d["fecha"] for d in dias] == ["2026-11-15", "2026-11-16", "2026-11-17"]
    assert [d["calorias"] for d in dias] == [0.0, 493.0, 0.0]


async def test_producto_del_catalogo_sin_tabla_toma_calorias_de_open_food_facts(escenario, monkeypatch):
    from app.services.nutricion import codigo_barra

    async def falso(codigo):
        assert codigo == escenario["codigo_sin_tabla"]
        return {"status": 1, "product": {"product_name": "Energetica", "nutriments": {"energy-kcal_100g": 10}}}

    monkeypatch.setattr(codigo_barra, "consultar_open_food_facts", falso)
    async with cliente() as c:
        r = await c.get(f"/api/nutricion/codigo-barra/{escenario['codigo_sin_tabla']}")
        assert r.status_code == 200, r.text
        datos = r.json()
        # Se mantiene el producto del catálogo (nombre, contenido neto) con las kcal de afuera.
        assert datos["origen"] == "catalogo" and datos["id_producto"] == escenario["sin_tabla"]
        assert datos["nombre"].startswith("Sin tabla") and datos["contenido_neto"] == 500.0
        assert datos["fuente_nutricional"] == "openfoodfacts" and datos["calorias"] == 10.0

        # La app lo anota como producto con las calorías explícitas (1 lata de 500 ml = 50 kcal).
        comida = await c.post("/api/nutricion/consumo/", json={
            "fecha_consumo": "2026-11-16T17:00:00", "tipo_comida": "once",
            "detalles": [{"id_producto": escenario["sin_tabla"], "cantidad_consumida": 1, "unidad_consumida": "unidad", "calorias": 50}],
        })
        assert comida.status_code == 201, comida.text
        assert comida.json()["total_calorias"] == 50.0


async def test_admin_guarda_la_tabla_de_open_food_facts_al_escanear(escenario, monkeypatch):
    from app.services.nutricion import codigo_barra

    consultas = []

    async def falso(codigo):
        consultas.append(codigo)
        return {"status": 1, "product": {
            "product_name": "Energetica", "product_quantity": 473, "product_quantity_unit": "ml",
            "nutriments": {"energy-kcal_100g": 10, "carbohydrates_100g": 2.5, "sugars_100g": 0, "sodium_100g": 0.08},
        }}

    monkeypatch.setattr(codigo_barra, "consultar_open_food_facts", falso)
    codigo = escenario["codigo_sin_tabla"]
    async with cliente() as c:
        # Sin ser administrador no se puede (la dependencia real exige superusuario).
        assert (await c.post(f"/api/nutricion/codigo-barra/{codigo}/tabla")).status_code in (401, 403)

        app.dependency_overrides[current_superuser] = lambda: escenario["auth"]
        guardada = await c.post(f"/api/nutricion/codigo-barra/{codigo}/tabla")
        assert guardada.status_code == 200, guardada.text
        assert guardada.json()["fuente_nutricional"] == "tabla" and guardada.json()["calorias"] == 10.0
        # El producto ya traía contenido neto (500 ml): no se reemplaza por el de afuera.
        assert guardada.json()["contenido_neto"] == 500.0

        # Repetir no crea otra tabla ni vuelve a consultar.
        assert (await c.post(f"/api/nutricion/codigo-barra/{codigo}/tabla")).status_code == 200
        assert len(consultas) == 1

        # Ahora el escaneo normal sale del catálogo y la línea se calcula sola en el backend.
        assert (await c.get(f"/api/nutricion/codigo-barra/{codigo}")).json()["fuente_nutricional"] == "tabla"
        comida = await c.post("/api/nutricion/consumo/", json={
            "fecha_consumo": "2026-11-16T17:00:00", "tipo_comida": "once",
            "detalles": [{"id_producto": escenario["sin_tabla"], "cantidad_consumida": 1, "unidad_consumida": "unidad"}],
        })
        assert comida.json()["total_calorias"] == 50.0

    async with AsyncSessionLocal() as db:
        tablas = (await db.execute(select(TablaNutricional).where(TablaNutricional.id_producto == escenario["sin_tabla"]))).scalars().all()
        assert len(tablas) == 1 and tablas[0].sodio == 80 and tablas[0].azucares == 0
