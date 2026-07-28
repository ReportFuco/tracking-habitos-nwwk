from fastapi import APIRouter

from .banco import router as banco_router
from .cuentas import router as cuentas_router
from .movimientos import router as movimientos_router
from .categoria import router as categoria_router
from .producto_financiero import router as producto_financiero_router
from .analitica import router as analitica_router

router = APIRouter(prefix="/finanzas")

router.include_router(cuentas_router)
router.include_router(movimientos_router)
router.include_router(analitica_router)
router.include_router(banco_router)
router.include_router(categoria_router)
router.include_router(producto_financiero_router)


__all__ = ["router"]
