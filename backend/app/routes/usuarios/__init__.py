from fastapi import APIRouter

from .usuario import router as usuario_router

router = APIRouter(prefix="/usuarios")

router.include_router(usuario_router)