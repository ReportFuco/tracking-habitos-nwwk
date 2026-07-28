from fastapi import APIRouter

from .categoria_producto import router as categoria_producto_router
from .marca import router as marca_router
from .producto import router as producto_router
from .subcategoria_producto import router as subcategoria_producto_router

router = APIRouter(prefix="/catalogo")
router.include_router(categoria_producto_router)
router.include_router(marca_router)
router.include_router(producto_router)
router.include_router(subcategoria_producto_router)

__all__ = ["router"]
