from .movimientos import (
    MovimientoResponse, 
    MovimientoPatch, 
    MovimientoCreate,
    MovimientoListResponse,
    MovimientoItemCreate,
    MovimientoItemPatch,
    MovimientoItemResponse,
)

from .banco import BancoCreate, BancoResponse
from .producto_financiero import (
    ProductoFinancieroCreate,
    ProductoFinancieroPatch,
    ProductoFinancieroResponse,
)

from .cuentas import (
    CuentaSaldoDeclarar,
    CuentaUsuarioCreate,
    CuentaUsuarioMovimientosResponse,
    CuentaUsuarioResponse,
    CuentaUsuarioPatch
)

from .categoria import (
    CategoriaResponse, 
    CategoriaPatch, 
    CategoriaCreate,
    CategoriaOcultar,
    MoverMovimientosRequest,
    MoverMovimientosResponse,
)
from .deudas import DeudaCreate, DeudaListResponse, DeudaPatch, DeudaResponse
from .importacion import (
    MAX_FILAS_IMPORTACION,
    CadenaSaldo,
    ControlSaldo,
    FilaImportacion,
    FilaPrevisualizada,
    MovimientoCoincidente,
    MovimientoPendiente,
    ImportacionesLista,
    ImportacionResumen,
    PrevisualizacionImportacion,
    ResultadoImportacion,
)
from .analitica import (
    AnaliticaResumenResponse,
    AnaliticaTendenciaMensualItem,
    AnaliticaTendenciaMensualResponse,
    AnaliticaDistribucionCategoriaItem,
    AnaliticaDistribucionCategoriasResponse,
    AnaliticaDistribucionCuentaItem,
    AnaliticaDistribucionCuentasResponse,
    AnaliticaDiariaItem,
    AnaliticaDiariaResponse,
)
from .reglas import (
    AplicarReglasRequest,
    AplicarReglasResponse,
    CambioReglas,
    ReglaCategoriaCreate,
    ReglaCategoriaResponse,
)
from .semanal import (
    AlertaSemana,
    CategoriaMeta,
    CategoriaMetaUpdate,
    CategoriaSemana,
    GastoDiaSemana,
    MetasGastoResponse,
    MetasGastoUpdate,
    ResumenSemanalResponse,
    SemanaTendencia,
    TendenciaSemanalResponse,
)


__all__ = [

    # Categorías
    "CategoriaResponse",
    "CategoriaPatch",
    "CategoriaCreate",
    "CategoriaOcultar",
    "MoverMovimientosRequest",
    "MoverMovimientosResponse",

    # Movimientos
    "MovimientoResponse",
    "MovimientoCreate",
    "MovimientoPatch",
    "MovimientoListResponse",
    "MovimientoItemCreate",
    "MovimientoItemPatch",
    "MovimientoItemResponse",

    # Deudas
    "DeudaCreate",
    "DeudaListResponse",
    "DeudaPatch",
    "DeudaResponse",

    # Importación (MCP)
    "MAX_FILAS_IMPORTACION",
    "FilaImportacion",
    "CadenaSaldo",
    "ControlSaldo",
    "FilaPrevisualizada",
    "MovimientoCoincidente",
    "MovimientoPendiente",
    "ImportacionesLista",
    "ImportacionResumen",
    "PrevisualizacionImportacion",
    "ResultadoImportacion",

    # Cuentas
    "CuentaUsuarioResponse",
    "CuentaUsuarioCreate",
    "CuentaSaldoDeclarar",
    "CuentaUsuarioPatch",
    "CuentaUsuarioMovimientosResponse",

    # Banco
    "BancoCreate",
    "BancoResponse",

    # Productos financieros
    "ProductoFinancieroCreate",
    "ProductoFinancieroPatch",
    "ProductoFinancieroResponse",

    # Analitica
    "AnaliticaResumenResponse",
    "AnaliticaTendenciaMensualItem",
    "AnaliticaTendenciaMensualResponse",
    "AnaliticaDistribucionCategoriaItem",
    "AnaliticaDistribucionCategoriasResponse",
    "AnaliticaDistribucionCuentaItem",
    "AnaliticaDistribucionCuentasResponse",

    # Reglas de categoría
    "AplicarReglasRequest",
    "AplicarReglasResponse",
    "CambioReglas",
    "ReglaCategoriaCreate",
    "ReglaCategoriaResponse",

    # Gasto semanal y metas
    "AlertaSemana",
    "CategoriaMeta",
    "CategoriaMetaUpdate",
    "CategoriaSemana",
    "GastoDiaSemana",
    "MetasGastoResponse",
    "MetasGastoUpdate",
    "ResumenSemanalResponse",
    "SemanaTendencia",
    "TendenciaSemanalResponse",
]
