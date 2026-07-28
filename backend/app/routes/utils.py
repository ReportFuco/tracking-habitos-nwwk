import unicodedata

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Usuario


_ACCENTED_CHARS = "áéíóúàèìòùäëïöüâêîôûãõñÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÂÊÎÔÛÃÕÑ"
_PLAIN_CHARS = "aeiouaeiouaeiouaeiouaonAEIOUAEIOUAEIOUAEIOUAON"


async def obtener_usuario_actual(user, db: AsyncSession) -> Usuario:
    usuario = await db.scalar(select(Usuario).where(Usuario.auth_user_id == user.id))
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Perfil no encontrado",
        )
    return usuario


def normalize_search_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.strip().lower())
    return "".join(char for char in normalized if not unicodedata.combining(char))


def normalize_sql_text(expression):
    return func.lower(func.translate(expression, _ACCENTED_CHARS, _PLAIN_CHARS))
