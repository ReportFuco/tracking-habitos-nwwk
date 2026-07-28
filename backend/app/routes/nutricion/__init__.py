from fastapi import APIRouter

from .consumo import router as consumo_router
from .consumo_detalle import router as consumo_detalle_router
from .meta_nutricional import router as meta_router
from .peso_usuario import router as peso_router
from .tabla_nutricional import router as tabla_router

router = APIRouter(prefix="/nutricion")
router.include_router(consumo_router)
router.include_router(consumo_detalle_router)
router.include_router(meta_router)
router.include_router(peso_router)
router.include_router(tabla_router)

__all__ = ["router"]
