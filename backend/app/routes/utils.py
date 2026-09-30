from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# Reexportadas: las rutas las importan desde aquí.
from app.core.texto import normalize_search_text, normalize_sql_text  # noqa: F401
from app.models import Usuario


async def obtener_usuario_actual(user, db: AsyncSession) -> Usuario:
    usuario = await db.scalar(select(Usuario).where(Usuario.auth_user_id == user.id))
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Perfil no encontrado",
        )
    return usuario


def es_superusuario(user) -> bool:
    """Si el usuario autenticado administra los catálogos compartidos."""
    return bool(getattr(user, "is_superuser", False))
