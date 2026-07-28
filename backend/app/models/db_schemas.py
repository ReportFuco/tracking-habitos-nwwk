AUTH_SCHEMA = "auth"
USUARIOS_SCHEMA = "usuarios"
HABITOS_SCHEMA = "habitos"
LECTURAS_SCHEMA = "lecturas"
FINANZAS_SCHEMA = "finanzas"
ENTRENAMIENTOS_SCHEMA = "entrenamientos"
COMPRAS_SCHEMA = "compras"
NUTRICION_SCHEMA = "nutricion"
CATALOGO_SCHEMA = "catalogo"


def table_ref(schema: str, table: str) -> str:
    return f"{schema}.{table}"
