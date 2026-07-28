from fastapi import APIRouter
from .libros import router as libros_router
from .registro_lectura import router as lecturas_router


router = APIRouter(prefix="/lecturas")

router.include_router(libros_router)
router.include_router(lecturas_router)