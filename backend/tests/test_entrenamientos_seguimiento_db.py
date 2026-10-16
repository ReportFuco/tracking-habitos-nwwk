"""Integracion PostgreSQL: carga muscular, notas de seguimiento por REST y por MCP.

Solo corre con RUN_DB_TESTS=1 y una base *_test (ver test_finanzas_movimientos_db.py).
"""
import os
import uuid
from datetime import datetime, timedelta

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
    from app.auth.fastapi_users import current_user_or_api_key
    from app.db.session import AsyncSessionLocal
    from app.main import app
    from app.models import (
        ApiKey,
        Ejercicios,
        Entrenamiento,
        EntrenamientoFuerza,
        Gimnasio,
        Musculo,
        SeguimientoIA,
        SerieFuerza,
        SubcategoriaMusculo,
        Usuario,
    )
    from app.models.entrenamiento import EnumEstadoEntrenamiento, EnumTipoEntrenamiento
    from app.models.usuario_auth import User
    from app.services.entrenamientos.carga import CHILE_TZ, calcular_carga, periodo_movil, periodo_semana
    from tests.test_mcp_finanzas import cliente_mcp


async def _subcategoria(db, musculo: str, subcategoria: str) -> int:
    return await db.scalar(
        select(SubcategoriaMusculo.id_subcategoria_musculo)
        .join(Musculo, Musculo.id_musculo == SubcategoriaMusculo.id_musculo)
        .where(Musculo.codigo == musculo, SubcategoriaMusculo.codigo == subcategoria)
    )


@pytest.fixture
async def escenario():
    """Una sesion hace 2 dias (press con mancuernas + encogimientos) y otra hace 10."""
    sufijo = uuid.uuid4().hex[:8]
    ahora = datetime.now(CHILE_TZ)
    async with AsyncSessionLocal() as db:
        auth = User(email=f"seg-{sufijo}@example.com", hashed_password="x", is_active=True)
        db.add(auth)
        await db.flush()
        usuario = Usuario(
            username=f"s{sufijo}", nombre="Seg", apellido="Test", telefono=f"7{sufijo[:7]}",
            email=auth.email, auth_user_id=auth.id,
        )
        gimnasio = Gimnasio(nombre_gimnasio=f"Gym seg {sufijo}", latitud=-33.4, longitud=-70.6, activo=True)
        press = Ejercicios(
            nombre=f"Press mancuernas test {sufijo}",
            id_subcategoria_musculo=await _subcategoria(db, "pecho", "medio"),
            equipamiento="Mancuernas",
            musculos_secundarios=["Hombros", "Tríceps"],
        )
        encogimiento = Ejercicios(
            nombre=f"Encogimientos test {sufijo}",
            id_subcategoria_musculo=await _subcategoria(db, "espalda", "trapecio"),
            equipamiento="Barra",
            musculos_secundarios=[],
        )
        db.add_all([usuario, gimnasio, press, encogimiento])
        await db.flush()

        sesiones = []
        for dias, estado in ((2, EnumEstadoEntrenamiento.ACTIVO), (10, EnumEstadoEntrenamiento.CERRADO)):
            entreno = Entrenamiento(id_usuario=usuario.id_usuario, tipo_entrenamiento=EnumTipoEntrenamiento.FUERZA)
            db.add(entreno)
            await db.flush()
            sesion = EntrenamientoFuerza(
                id_entrenamiento=entreno.id_entrenamiento,
                id_gimnasio=gimnasio.id_gimnasio,
                estado=estado,
                inicio_at=ahora - timedelta(days=dias),
            )
            db.add(sesion)
            await db.flush()
            sesiones.append(sesion)

        reciente, vieja = sesiones

        def serie(sesion, ejercicio, peso, reps, calentamiento=False):
            return SerieFuerza(
                id_entrenamiento_fuerza=sesion.id_entrenamiento_fuerza,
                id_ejercicio=ejercicio.id_ejercicio,
                es_calentamiento=calentamiento,
                cantidad_peso=peso,
                repeticiones=reps,
            )

        db.add_all([
            serie(reciente, press, 20, 10, calentamiento=True),
            serie(reciente, press, 30, 10),
            serie(reciente, press, 30, 10),
            serie(reciente, press, 30, 10),
            serie(reciente, encogimiento, 60, 8),
            serie(vieja, press, 28, 10),
            serie(vieja, press, 28, 10),
        ])

        keys = {}
        for nombre, scopes in (("Claude lectura", ["entrenamientos:read"]), ("Claude coach", ["entrenamientos:write"])):
            valor, prefijo, key_hash = generate_api_key()
            db.add(ApiKey(auth_user_id=auth.id, nombre=nombre, key_prefix=prefijo, key_hash=key_hash, scopes=scopes))
            keys[nombre] = valor
        await db.commit()
        datos = {
            "auth": auth,
            "id_usuario": usuario.id_usuario,
            "gimnasio": gimnasio.id_gimnasio,
            "ejercicios": [press.id_ejercicio, encogimiento.id_ejercicio],
            "press": press.id_ejercicio,
            "vieja": vieja.inicio_at,
            "key_lectura": keys["Claude lectura"],
            "key_escritura": keys["Claude coach"],
        }

    yield datos
    app.dependency_overrides.clear()

    async with AsyncSessionLocal() as db:
        await db.execute(delete(SerieFuerza).where(SerieFuerza.id_ejercicio.in_(datos["ejercicios"])))
        entrenos = select(Entrenamiento.id_entrenamiento).where(Entrenamiento.id_usuario == datos["id_usuario"])
        await db.execute(delete(EntrenamientoFuerza).where(EntrenamientoFuerza.id_entrenamiento.in_(entrenos)))
        await db.execute(delete(Entrenamiento).where(Entrenamiento.id_usuario == datos["id_usuario"]))
        await db.execute(delete(Ejercicios).where(Ejercicios.id_ejercicio.in_(datos["ejercicios"])))
        await db.execute(delete(Gimnasio).where(Gimnasio.id_gimnasio == datos["gimnasio"]))
        await db.execute(delete(SeguimientoIA).where(SeguimientoIA.id_usuario == datos["id_usuario"]))
        await db.execute(delete(ApiKey).where(ApiKey.auth_user_id == datos["auth"].id))
        await db.execute(delete(Usuario).where(Usuario.id_usuario == datos["id_usuario"]))
        await db.execute(delete(User).where(User.id == datos["auth"].id))
        await db.commit()


async def test_carga_de_los_ultimos_siete_dias(escenario):
    async with AsyncSessionLocal() as db:
        carga = await calcular_carga(db, escenario["id_usuario"], periodo_movil())

    zonas = {zona.codigo: zona for zona in carga.zonas}
    # Sin el calentamiento ni la sesion de hace 10 dias.
    assert (carga.sesiones, carga.series_trabajo) == (1, 4)
    assert (zonas["pecho"].series, zonas["pecho"].directas) == (3, 3)
    # Con mancuernas el peso es por mancuerna: el tonelaje cuenta las dos.
    assert zonas["pecho"].tonelaje == 3 * 30 * 10 * 2
    assert (zonas["hombro"].series, zonas["hombro"].indirectas) == (1.5, 3)
    assert zonas["tricep"].series == 1.5
    assert zonas["trapecio"].series == 1
    assert zonas["dorsal"].series == 0
    assert zonas["cuadricep"].nivel == "sin_trabajo"


async def test_semana_calendario_incluye_la_sesion_de_esa_semana(escenario):
    async with AsyncSessionLocal() as db:
        carga = await calcular_carga(
            db, escenario["id_usuario"], periodo_semana(escenario["vieja"].astimezone(CHILE_TZ).date())
        )

    zonas = {zona.codigo: zona for zona in carga.zonas}
    assert zonas["pecho"].series == 2
    assert zonas["trapecio"].series == 0


async def test_carga_por_rest(escenario):
    app.dependency_overrides[current_user_or_api_key] = lambda: escenario["auth"]
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        r = await client.get("/api/entrenamientos/carga-muscular", params={"modo": "7d"})

    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert cuerpo["etiqueta"] == "Últimos 7 días"
    pecho = next(zona for zona in cuerpo["zonas"] if zona["codigo"] == "pecho")
    assert pecho["series"] == 3
    assert len(pecho["ejercicios"]) == 1 and pecho["ejercicios"][0].startswith("Press mancuernas test")


async def test_publicar_seguimiento_por_mcp_exige_escritura(escenario):
    nota = {
        "tipo": "alerta",
        "titulo": "Hombros con mucho volumen indirecto",
        "contenido": "Llevas 1,5 series indirectas de hombro.\n- Baja el press un poco.",
        "zonas": ["hombro", "pecho"],
    }
    async with cliente_mcp(escenario["key_lectura"]) as cliente:
        denegado = await cliente.call_tool("publicar_seguimiento", nota)
        carga = await cliente.call_tool("carga_muscular", {"modo": "7d"})
    async with cliente_mcp(escenario["key_escritura"]) as cliente:
        publicado = await cliente.call_tool("publicar_seguimiento", nota)
        zona_invalida = await cliente.call_tool("publicar_seguimiento", {**nota, "zonas": ["rodilla"]})

    assert denegado.is_error
    assert not carga.is_error
    assert not publicado.is_error, publicado.content
    assert publicado.structured_content["origen"] == "Claude coach"
    assert zona_invalida.is_error

    app.dependency_overrides[current_user_or_api_key] = lambda: escenario["auth"]
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        lista = (await client.get("/api/entrenamientos/seguimiento")).json()["seguimientos"]
        assert [n["titulo"] for n in lista] == [nota["titulo"]]
        assert lista[0]["zonas"] == ["hombro", "pecho"]
        borrado = await client.delete(f"/api/entrenamientos/seguimiento/{lista[0]['id_seguimiento']}")
        assert borrado.status_code == 204
        assert (await client.get("/api/entrenamientos/seguimiento")).json()["seguimientos"] == []


async def test_progreso_y_sesiones_por_mcp(escenario):
    async with cliente_mcp(escenario["key_lectura"]) as cliente:
        progreso = await cliente.call_tool("progreso_ejercicio", {"id_ejercicio": escenario["press"]})
        sesiones = await cliente.call_tool("listar_sesiones_fuerza", {})

    assert not progreso.is_error, progreso.content
    filas = progreso.structured_content["sesiones"]
    assert [fila["mejor_peso_kg"] for fila in filas] == [28, 30]
    assert progreso.structured_content["por_mancuerna"] is True
    resumen = sesiones.structured_content["sesiones"]
    assert [s["series_trabajo"] for s in resumen] == [4, 2]
    assert resumen[0]["zonas"] == ["pecho", "trapecio"]
