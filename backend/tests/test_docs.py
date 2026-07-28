from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_docs_menu_exposes_module_links():
    response = client.get("/docs")

    assert response.status_code == 200
    assert "/docs/global" in response.text
    assert "/docs/finanzas" in response.text
    assert "/docs/compras" in response.text
    assert "/docs/auth" in response.text


def test_finanzas_openapi_only_contains_finanzas_routes():
    response = client.get("/openapi/finanzas.json")

    assert response.status_code == 200
    payload = response.json()

    assert "/api/finanzas/cuentas/" in payload["paths"]
    assert "/api/finanzas/movimientos/" in payload["paths"]
    assert "/api/compras/compra/" not in payload["paths"]
    assert "/auth/register" not in payload["paths"]


def test_auth_openapi_only_contains_auth_routes():
    response = client.get("/openapi/auth.json")

    assert response.status_code == 200
    payload = response.json()

    assert "/auth/register" in payload["paths"]
    assert "/auth/jwt/login" in payload["paths"]
    assert "/api/usuarios/perfil" not in payload["paths"]


def test_module_swagger_has_link_back_to_menu():
    response = client.get("/docs/finanzas")

    assert response.status_code == 200
    assert 'href="/docs"' in response.text
    assert "Volver al menu" in response.text


def test_redoc_is_still_available():
    response = client.get("/redoc")

    assert response.status_code == 200
    assert 'href="/docs"' in response.text
