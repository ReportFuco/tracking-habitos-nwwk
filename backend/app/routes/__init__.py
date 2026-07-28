from fastapi import APIRouter
from .catalogo import router as catalogo_router
from .compras import router as compras_router
from .entrenamientos import router as entrenamientos_router
from .finanzas import router as finanzas_router
from .lecturas import router as lecturas_router
from .nutricion import router as nutricion_router
from .usuarios import router as usuario_router


router = APIRouter(prefix="/api")

router.include_router(usuario_router)
router.include_router(catalogo_router)
router.include_router(compras_router)
router.include_router(finanzas_router)
router.include_router(entrenamientos_router)
router.include_router(lecturas_router)
router.include_router(nutricion_router)


__all__ = ["router"]
