from fastapi import APIRouter
from .ejercicios import router as ejercicios_router
from .gimnasio import router as gimnasio_router
from .fuerza import router as fuerza_router
from .series_fuerza import router as series_fuerza_router


router = APIRouter(prefix="/entrenamientos")


router.include_router(gimnasio_router)
router.include_router(fuerza_router)
router.include_router(series_fuerza_router)
router.include_router(ejercicios_router)


__all__ = ["router"]
