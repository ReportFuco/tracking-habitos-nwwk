"""Permisos (scopes) de las API keys.

Una key lleva una lista de scopes. ``*`` es acceso total (lo que tenian todas las keys
antes de existir los scopes). Los de finanzas limitan la key a ese modulo:
``finanzas:read`` para leer y ``finanzas:write`` para crear, editar y borrar, que
incluye leer.

La API REST deduce el scope que exige cada request de su ruta y metodo; el servidor MCP
lo exige herramienta por herramienta.
"""
from typing import Literal


SCOPE_TOTAL = "*"
FINANZAS_READ = "finanzas:read"
FINANZAS_WRITE = "finanzas:write"

Scope = Literal["*", "finanzas:read", "finanzas:write"]

_METODOS_LECTURA = {"GET", "HEAD", "OPTIONS"}
_PREFIJO_FINANZAS = "/api/finanzas/"


def scope_requerido(metodo: str, path: str) -> str:
    """Scope que necesita una request REST autenticada con API key."""
    if path.startswith(_PREFIJO_FINANZAS) or path == _PREFIJO_FINANZAS.rstrip("/"):
        return FINANZAS_READ if metodo.upper() in _METODOS_LECTURA else FINANZAS_WRITE
    return SCOPE_TOTAL


def tiene_scope(scopes: list[str] | None, requerido: str) -> bool:
    otorgados = set(scopes or ())
    if SCOPE_TOTAL in otorgados or requerido in otorgados:
        return True
    return requerido == FINANZAS_READ and FINANZAS_WRITE in otorgados
