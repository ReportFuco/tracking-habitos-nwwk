from contextlib import contextmanager

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Usuario
from app.services.errores import Conflicto, NoEncontrado
from app.services.usuarios import obtener_perfil


@contextmanager
def errores_http():
    """Traduce los errores de dominio de los servicios a respuestas HTTP."""
    try:
        yield
    except NoEncontrado as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.mensaje) from exc
    except Conflicto as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.mensaje) from exc


async def obtener_usuario_actual(user, db: AsyncSession) -> Usuario:
    with errores_http():
        return await obtener_perfil(db, user.id)
