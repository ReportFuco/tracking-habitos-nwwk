"""Notas de seguimiento que la IA deja al usuario por MCP y que se leen en la app."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SeguimientoIA
from app.services.entrenamientos.carga import ZONAS
from app.services.errores import NoEncontrado, DatosInvalidos


MAX_CONTENIDO = 8000


async def crear_seguimiento(
    db: AsyncSession,
    id_usuario: int,
    *,
    tipo: str,
    titulo: str,
    contenido: str,
    zonas: list[str] | None = None,
    origen: str | None = None,
) -> SeguimientoIA:
    titulo = titulo.strip()
    contenido = contenido.strip()
    if not titulo or not contenido:
        raise DatosInvalidos("El titulo y el contenido no pueden quedar vacios.")
    if len(contenido) > MAX_CONTENIDO:
        raise DatosInvalidos(f"El contenido no puede pasar de {MAX_CONTENIDO} caracteres.")
    desconocidas = sorted(set(zonas or ()) - set(ZONAS))
    if desconocidas:
        raise DatosInvalidos(
            f"Zonas desconocidas: {', '.join(desconocidas)}. Validas: {', '.join(ZONAS)}."
        )

    seguimiento = SeguimientoIA(
        id_usuario=id_usuario,
        tipo=tipo,
        titulo=titulo[:160],
        contenido=contenido,
        zonas=list(dict.fromkeys(zonas)) if zonas else None,
        origen=(origen or "")[:120] or None,
    )
    db.add(seguimiento)
    await db.flush()
    return seguimiento


async def listar_seguimientos(
    db: AsyncSession,
    id_usuario: int,
    *,
    limite: int = 20,
) -> list[SeguimientoIA]:
    return list(
        (
            await db.scalars(
                select(SeguimientoIA)
                .where(SeguimientoIA.id_usuario == id_usuario)
                .order_by(SeguimientoIA.created_at.desc(), SeguimientoIA.id_seguimiento.desc())
                .limit(limite)
            )
        ).all()
    )


async def eliminar_seguimiento(db: AsyncSession, id_usuario: int, id_seguimiento: int) -> None:
    seguimiento = await db.scalar(
        select(SeguimientoIA).where(
            SeguimientoIA.id_seguimiento == id_seguimiento,
            SeguimientoIA.id_usuario == id_usuario,
        )
    )
    if seguimiento is None:
        raise NoEncontrado("Nota de seguimiento no encontrada.")
    await db.delete(seguimiento)
