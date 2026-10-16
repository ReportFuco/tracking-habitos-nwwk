"""Permisos (scopes) de las API keys y de las conexiones OAuth.

Una key lleva una lista de scopes. ``*`` es acceso total (lo que tenian todas las keys
antes de existir los scopes). El resto limita el acceso por modulo: ``<modulo>:read``
para leer y ``<modulo>:write`` para crear, editar y borrar, que incluye leer.

La API REST deduce el scope que exige cada request de su ruta y metodo; el servidor MCP
lo exige herramienta por herramienta.
"""
from typing import Literal


SCOPE_TOTAL = "*"
FINANZAS_READ = "finanzas:read"
FINANZAS_WRITE = "finanzas:write"
ENTRENAMIENTOS_READ = "entrenamientos:read"
ENTRENAMIENTOS_WRITE = "entrenamientos:write"

Scope = Literal[
    "*",
    "finanzas:read",
    "finanzas:write",
    "entrenamientos:read",
    "entrenamientos:write",
]

# Modulo -> prefijo de sus rutas REST.
MODULOS = {
    "finanzas": "/api/finanzas",
    "entrenamientos": "/api/entrenamientos",
}

_METODOS_LECTURA = {"GET", "HEAD", "OPTIONS"}


def scope_requerido(metodo: str, path: str) -> str:
    """Scope que necesita una request REST autenticada con API key."""
    accion = "read" if metodo.upper() in _METODOS_LECTURA else "write"
    for modulo, prefijo in MODULOS.items():
        if path == prefijo or path.startswith(f"{prefijo}/"):
            return f"{modulo}:{accion}"
    return SCOPE_TOTAL


def con_lectura_implicita(scopes: list[str]) -> list[str]:
    """Agrega el read de cada write: se guarda explicito para que un refresh OAuth pueda
    pedir solo lectura."""
    completos = set(scopes)
    for scope in scopes:
        if scope.endswith(":write"):
            completos.add(scope.removesuffix(":write") + ":read")
    return sorted(completos)


def tiene_scope(scopes: list[str] | None, requerido: str) -> bool:
    otorgados = set(scopes or ())
    if SCOPE_TOTAL in otorgados or requerido in otorgados:
        return True
    # Escribir en un modulo incluye leerlo.
    return requerido.endswith(":read") and (
        requerido.removesuffix(":read") + ":write"
    ) in otorgados
