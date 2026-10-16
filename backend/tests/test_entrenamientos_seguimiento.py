from datetime import date, datetime

import pytest

from app.auth.scopes import con_lectura_implicita, scope_requerido, tiene_scope
from app.mcp.oauth import SCOPES_OAUTH
from app.services.entrenamientos.carga import (
    CHILE_TZ,
    nivel_de,
    periodo_movil,
    periodo_semana,
    zona_principal,
    zonas_secundarias,
)
from app.services.entrenamientos.sesiones import rm_estimado


@pytest.mark.parametrize(
    ("metodo", "path", "esperado"),
    [
        ("GET", "/api/entrenamientos/carga-muscular", "entrenamientos:read"),
        ("DELETE", "/api/entrenamientos/seguimiento/3", "entrenamientos:write"),
        ("GET", "/api/entrenamientosx", "*"),
    ],
)
def test_rutas_de_entrenamientos_piden_su_scope(metodo, path, esperado):
    assert scope_requerido(metodo, path) == esperado


def test_escribir_un_modulo_no_da_acceso_a_otro():
    assert tiene_scope(["entrenamientos:write"], "entrenamientos:read")
    assert not tiene_scope(["finanzas:write"], "entrenamientos:read")
    assert not tiene_scope(["entrenamientos:read"], "entrenamientos:write")


def test_aprobar_escritura_guarda_tambien_la_lectura():
    assert con_lectura_implicita(["entrenamientos:write", "finanzas:read"]) == [
        "entrenamientos:read",
        "entrenamientos:write",
        "finanzas:read",
    ]


def test_oauth_ofrece_entrenamientos():
    assert {"entrenamientos:read", "entrenamientos:write"} <= set(SCOPES_OAUTH)


@pytest.mark.parametrize(
    ("series", "nivel"),
    [(0, "sin_trabajo"), (3.5, "bajo"), (4, "moderado"), (12, "optimo"), (20, "optimo"), (20.5, "alto")],
)
def test_niveles_de_carga(series, nivel):
    assert nivel_de(series) == nivel


def test_espalda_se_reparte_por_subcategoria():
    assert zona_principal("espalda", "trapecio") == "trapecio"
    assert zona_principal("espalda", "espalda_baja") == "lumbar"
    assert zona_principal("espalda", "dorsales") == "dorsal"
    assert zona_principal("pecho", "superior") == "pecho"
    assert zona_principal("cardio", "general") is None


def test_secundarios_sin_repetir_el_principal_ni_zonas_sin_mapa():
    assert zonas_secundarias(["Hombros", "Tríceps", "Pecho", "Pies"], "pecho") == {"hombro", "tricep"}


def test_semana_va_de_lunes_a_lunes_en_hora_de_chile():
    periodo = periodo_semana(date(2026, 10, 16))  # viernes

    assert periodo.desde == datetime(2026, 10, 12, tzinfo=CHILE_TZ)
    assert periodo.hasta == datetime(2026, 10, 19, tzinfo=CHILE_TZ)


def test_periodo_movil_son_los_ultimos_siete_dias():
    ahora = datetime(2026, 10, 16, 18, 30, tzinfo=CHILE_TZ)
    periodo = periodo_movil(ahora)

    assert periodo.hasta == ahora
    assert periodo.desde == datetime(2026, 10, 9, 18, 30, tzinfo=CHILE_TZ)


def test_rm_estimado_epley():
    assert rm_estimado(100, 1) == 100
    assert round(rm_estimado(100, 5), 1) == 116.7
