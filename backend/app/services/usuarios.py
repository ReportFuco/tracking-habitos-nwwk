from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Usuario
from app.services.errores import NoEncontrado


async def obtener_perfil(db: AsyncSession, auth_user_id: int) -> Usuario:
    """Perfil de dominio (usuarios.usuario) asociado a una identidad de auth."""
    usuario = await db.scalar(
        select(Usuario).where(Usuario.auth_user_id == auth_user_id)
    )
    if not usuario:
        raise NoEncontrado("Perfil de usuario no encontrado.")
    return usuario
