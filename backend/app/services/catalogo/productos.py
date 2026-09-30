"""Catálogo de productos que crece con el uso.

Solo un superusuario crea productos (la ruta lo exige), y nacen aprobados. Los usuarios
eligen del catálogo al detallar un gasto. El flujo de revisión sigue para los productos
``pendiente`` que propusieron usuarios antes de ese cambio: solo los ve quien los creó
hasta que un superusuario los aprueba, los rechaza o los fusiona con uno aprobado.
"""
from sqlalchemy import case, delete, desc, func, literal, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.texto import normalize_search_text, normalize_sql_text
from app.models import (
    CategoriaProducto,
    ConsumoDetalle,
    CuentaUsuario,
    EstadoProducto,
    Marca,
    Movimiento,
    MovimientoItem,
    Producto,
    SubcategoriaProducto,
    TablaNutricional,
    Usuario,
)
from app.schemas.catalogo import ProductoCreate, ProductoPatch
from app.services.errores import Conflicto, DatosInvalidos, NoEncontrado, SinPermiso


def _opciones() -> tuple:
    return (
        selectinload(Producto.categoria_rel),
        selectinload(Producto.subcategoria_rel),
        selectinload(Producto.marca),
    )


def condicion_visible(usuario: Usuario | None):
    """Aprobados para todos; pendientes y rechazados solo para su creador."""
    if usuario is None:
        return Producto.estado == EstadoProducto.APROBADO
    return or_(
        Producto.estado == EstadoProducto.APROBADO,
        Producto.id_usuario_creador == usuario.id_usuario,
    )


async def _recargar(db: AsyncSession, id_producto: int) -> Producto:
    return await db.scalar(
        select(Producto)
        .execution_options(populate_existing=True)
        .where(Producto.id_producto == id_producto)
        .options(*_opciones())
    )


async def buscar_productos(
    db: AsyncSession,
    usuario: Usuario | None,
    *,
    q: str | None = None,
    limit: int = 100,
    incluir_inactivos: bool = False,
) -> list[Producto]:
    """Productos visibles. ``q`` busca en nombre, marca, formato y sabor (sin tildes y
    tolerando errores de tipeo) y en el código de barra exacto; ordena por relevancia."""
    consulta = (
        select(Producto)
        .outerjoin(Marca, Producto.id_marca == Marca.id_marca)
        .where(condicion_visible(usuario))
    )
    if not incluir_inactivos:
        consulta = consulta.where(Producto.activo.is_(True))

    palabras = normalize_search_text(q).split() if q else []
    if not palabras:
        consulta = consulta.order_by(func.lower(Producto.nombre_producto), Producto.id_producto)
        return (await db.execute(consulta.limit(limit).options(*_opciones()))).scalars().all()

    # Cada palabra tiene que aparecer (como substring) o parecerse lo suficiente a alguna
    # palabra del producto (pg_trgm), para tolerar errores de tipeo: "mosnter" -> Monster.
    # Se ordena por relevancia: coincidencias exactas primero, luego las parecidas.
    texto = normalize_sql_text(
        func.concat_ws(" ", Producto.nombre_producto, Marca.nombre_marca, Producto.formato, Producto.sabor)
    )
    puntaje = literal(0.0)
    for palabra in palabras:
        contiene = texto.like(f"%{_escapar_like(palabra)}%", escape="\\")
        if len(palabra) < MIN_LETRAS_PARECIDO:
            consulta = consulta.where(or_(contiene, Producto.codigo_barra == palabra))
            puntaje = puntaje + case((contiene, 1.0), else_=0.0)
            continue
        parecido = func.word_similarity(palabra, texto)
        consulta = consulta.where(or_(contiene, parecido >= UMBRAL_PARECIDO, Producto.codigo_barra == palabra))
        puntaje = puntaje + case((contiene, 1.0), else_=parecido)
    frase = " ".join(palabras)
    puntaje = puntaje + case(
        (normalize_sql_text(Producto.nombre_producto).like(f"{_escapar_like(frase)}%", escape="\\"), 0.5),
        else_=0.0,
    )
    consulta = consulta.order_by(desc(puntaje), func.lower(Producto.nombre_producto), Producto.id_producto)
    return (await db.execute(consulta.limit(limit).options(*_opciones()))).scalars().all()


# word_similarity va de 0 a 1 y compara trigramas: dos letras invertidas en una palabra
# de 7 ("mosnter" / "monster") dejan 0.33. 0.3 es el umbral por defecto de pg_trgm. En
# palabras de menos de 4 letras casi todo "se parece", asi que ahi solo vale el substring.
UMBRAL_PARECIDO = 0.3
MIN_LETRAS_PARECIDO = 4


def _escapar_like(texto: str) -> str:
    return texto.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


async def productos_frecuentes(db: AsyncSession, usuario: Usuario, limit: int = 12) -> list[Producto]:
    """Los productos que el usuario más ha comprado, para elegirlos con un toque."""
    usos = (
        select(MovimientoItem.id_producto, func.count().label("veces"), func.max(Movimiento.created_at).label("ultima"))
        .join(Movimiento, MovimientoItem.id_movimiento == Movimiento.id_transaccion)
        .join(CuentaUsuario, Movimiento.id_cuenta == CuentaUsuario.id_cuenta)
        .where(CuentaUsuario.id_usuario == usuario.id_usuario)
        .group_by(MovimientoItem.id_producto)
        .subquery()
    )
    consulta = (
        select(Producto)
        .join(usos, usos.c.id_producto == Producto.id_producto)
        .where(condicion_visible(usuario), Producto.activo.is_(True))
        .order_by(desc(usos.c.veces), desc(usos.c.ultima))
        .limit(limit)
        .options(*_opciones())
    )
    return (await db.execute(consulta)).scalars().all()


async def obtener_producto(
    db: AsyncSession,
    usuario: Usuario | None,
    id_producto: int,
    *,
    es_admin: bool = False,
) -> Producto:
    consulta = select(Producto).where(Producto.id_producto == id_producto).options(*_opciones())
    if not es_admin:
        consulta = consulta.where(condicion_visible(usuario))
    producto = await db.scalar(consulta)
    if not producto:
        raise NoEncontrado("Producto no encontrado.")
    return producto


async def _validar_referencias(
    db: AsyncSession,
    *,
    id_marca: int | None,
    id_categoria: int | None,
    id_subcategoria: int | None,
) -> tuple[int | None, int | None]:
    """Valida marca, categoría y subcategoría. Devuelve (categoría, subcategoría): sin
    categoría explícita se hereda la de la subcategoría."""
    if id_marca is not None and not await db.get(Marca, id_marca):
        raise NoEncontrado("Marca no encontrada.")

    if id_categoria is not None and not await db.get(CategoriaProducto, id_categoria):
        raise NoEncontrado("Categoría no encontrada.")

    if id_subcategoria is not None:
        subcategoria = await db.get(SubcategoriaProducto, id_subcategoria)
        if not subcategoria:
            raise NoEncontrado("Subcategoría no encontrada.")
        if id_categoria is None:
            id_categoria = subcategoria.id_categoria
        elif subcategoria.id_categoria != id_categoria:
            raise DatosInvalidos("La subcategoría no pertenece a la categoría enviada.")

    return id_categoria, id_subcategoria


async def _validar_codigo_barra(
    db: AsyncSession,
    codigo_barra: str | None,
    *,
    usuario: Usuario | None,
    excluir_id: int | None = None,
) -> None:
    """El código no puede repetir uno del catálogo aprobado ni otro del mismo usuario."""
    if codigo_barra is None:
        return
    consulta = select(Producto).where(
        Producto.codigo_barra == codigo_barra,
        condicion_visible(usuario),
    )
    if excluir_id is not None:
        consulta = consulta.where(Producto.id_producto != excluir_id)
    existente = await db.scalar(consulta.limit(1))
    if existente:
        raise Conflicto(f"El código de barra ya corresponde a «{existente.nombre_producto}».")


async def _validar_nombre_disponible(
    db: AsyncSession,
    nombre: str,
    id_marca: int | None,
    *,
    usuario: Usuario | None,
    excluir_id: int | None = None,
) -> None:
    """Evita el duplicado más evidente: mismo nombre (sin tildes ni mayúsculas) y marca."""
    consulta = select(Producto).where(
        normalize_sql_text(Producto.nombre_producto) == normalize_search_text(nombre),
        Producto.id_marca.is_(None) if id_marca is None else Producto.id_marca == id_marca,
        Producto.activo.is_(True),
        condicion_visible(usuario),
    )
    if excluir_id is not None:
        consulta = consulta.where(Producto.id_producto != excluir_id)
    existente = await db.scalar(consulta.limit(1))
    if existente:
        raise Conflicto(f"Ya existe el producto «{existente.nombre_producto}»: búscalo y úsalo.")


async def crear_producto(
    db: AsyncSession,
    usuario: Usuario | None,
    data: ProductoCreate,
    *,
    es_admin: bool = False,
) -> Producto:
    if usuario is None and not es_admin:
        raise SinPermiso("Se requiere un perfil para crear productos.")

    payload = data.model_dump()
    if not es_admin:
        # Un usuario no decide si su propuesta nace activa: eso es del administrador.
        payload["activo"] = True
    payload["id_categoria"], payload["id_subcategoria"] = await _validar_referencias(
        db,
        id_marca=payload["id_marca"],
        id_categoria=payload["id_categoria"],
        id_subcategoria=payload["id_subcategoria"],
    )
    await _validar_codigo_barra(db, payload["codigo_barra"], usuario=usuario)
    await _validar_nombre_disponible(db, payload["nombre_producto"], payload["id_marca"], usuario=usuario)

    producto = Producto(
        **payload,
        id_usuario_creador=usuario.id_usuario if usuario else None,
        estado=EstadoProducto.APROBADO if es_admin else EstadoProducto.PENDIENTE,
    )
    db.add(producto)
    await db.flush()
    return await _recargar(db, producto.id_producto)


async def editar_producto(
    db: AsyncSession,
    usuario: Usuario | None,
    id_producto: int,
    data: ProductoPatch,
    *,
    es_admin: bool = False,
) -> Producto:
    """El administrador edita cualquiera; un usuario, solo sus propuestas aún no aprobadas.

    Si el usuario corrige una propuesta rechazada, vuelve a quedar pendiente de revisión.
    """
    producto = await obtener_producto(db, usuario, id_producto, es_admin=es_admin)
    if not es_admin:
        es_suyo = usuario is not None and producto.id_usuario_creador == usuario.id_usuario
        if not es_suyo or producto.estado == EstadoProducto.APROBADO:
            raise SinPermiso("Los productos del catálogo compartido solo los edita un administrador.")

    cambios = data.model_dump(exclude_unset=True)
    if not cambios:
        raise DatosInvalidos("No se enviaron cambios.")
    if "activo" in cambios and not es_admin:
        raise SinPermiso("Solo un administrador puede activar o desactivar productos.")
    if "nombre_producto" in cambios and cambios["nombre_producto"] is None:
        raise DatosInvalidos("El nombre del producto no puede quedar vacío.")

    # Cambiar de categoría sin decir la subcategoría deja la subcategoría vieja huérfana.
    if (
        "id_categoria" in cambios
        and "id_subcategoria" not in cambios
        and cambios["id_categoria"] != producto.id_categoria
    ):
        cambios["id_subcategoria"] = None
    if "id_categoria" in cambios or "id_subcategoria" in cambios or "id_marca" in cambios:
        cambios["id_categoria"], cambios["id_subcategoria"] = await _validar_referencias(
            db,
            id_marca=cambios.get("id_marca", producto.id_marca),
            id_categoria=cambios.get("id_categoria", producto.id_categoria),
            id_subcategoria=cambios.get("id_subcategoria", producto.id_subcategoria),
        )

    alcance = None if es_admin and producto.estado == EstadoProducto.APROBADO else usuario
    if cambios.get("codigo_barra") is not None:
        await _validar_codigo_barra(db, cambios["codigo_barra"], usuario=alcance, excluir_id=id_producto)
    if "nombre_producto" in cambios or "id_marca" in cambios:
        await _validar_nombre_disponible(
            db,
            cambios.get("nombre_producto", producto.nombre_producto),
            cambios.get("id_marca", producto.id_marca),
            usuario=alcance,
            excluir_id=id_producto,
        )

    for field, value in cambios.items():
        setattr(producto, field, value)
    if not es_admin and producto.estado == EstadoProducto.RECHAZADO:
        producto.estado = EstadoProducto.PENDIENTE

    await db.flush()
    return await _recargar(db, id_producto)


async def desactivar_producto(db: AsyncSession, id_producto: int) -> None:
    producto = await obtener_producto(db, None, id_producto, es_admin=True)
    producto.activo = False
    await db.flush()


async def listar_para_revision(db: AsyncSession, estado: str = EstadoProducto.PENDIENTE) -> list[Producto]:
    """Propuestas de los usuarios, las más antiguas primero, con quién las creó."""
    return (
        await db.execute(
            select(Producto)
            .where(Producto.estado == estado, Producto.activo.is_(True))
            .order_by(Producto.created_at, Producto.id_producto)
            .options(*_opciones(), selectinload(Producto.creador))
        )
    ).scalars().all()


async def aprobar_producto(db: AsyncSession, id_producto: int) -> Producto:
    producto = await obtener_producto(db, None, id_producto, es_admin=True)
    if producto.estado == EstadoProducto.APROBADO:
        return producto
    try:
        await _validar_codigo_barra(db, producto.codigo_barra, usuario=None, excluir_id=id_producto)
        await _validar_nombre_disponible(
            db, producto.nombre_producto, producto.id_marca, usuario=None, excluir_id=id_producto
        )
    except Conflicto as exc:
        raise Conflicto(f"{exc.mensaje.split(':')[0].rstrip('.')}. Fusiónalo con ese producto en vez de aprobarlo.") from exc
    producto.estado = EstadoProducto.APROBADO
    await db.flush()
    return await _recargar(db, id_producto)


async def rechazar_producto(db: AsyncSession, id_producto: int) -> Producto:
    producto = await obtener_producto(db, None, id_producto, es_admin=True)
    if producto.estado == EstadoProducto.APROBADO:
        raise Conflicto("El producto ya está aprobado; desactívalo si no debe usarse.")
    producto.estado = EstadoProducto.RECHAZADO
    await db.flush()
    return await _recargar(db, id_producto)


async def fusionar_producto(db: AsyncSession, id_origen: int, id_destino: int) -> Producto:
    """Pasa todos los usos del duplicado al producto aprobado y elimina el duplicado."""
    if id_origen == id_destino:
        raise DatosInvalidos("No se puede fusionar un producto consigo mismo.")
    await obtener_producto(db, None, id_origen, es_admin=True)
    destino = await obtener_producto(db, None, id_destino, es_admin=True)
    if destino.estado != EstadoProducto.APROBADO or not destino.activo:
        raise Conflicto("El producto que se conserva debe estar aprobado y activo.")

    await db.execute(
        update(MovimientoItem).where(MovimientoItem.id_producto == id_origen).values(id_producto=id_destino)
    )
    await db.execute(
        update(ConsumoDetalle).where(ConsumoDetalle.id_producto == id_origen).values(id_producto=id_destino)
    )
    # Si el destino ya tiene tabla nutricional, la del duplicado sobra.
    destino_tiene_tabla = await db.scalar(
        select(TablaNutricional.id_tabla).where(TablaNutricional.id_producto == id_destino).limit(1)
    )
    if destino_tiene_tabla is None:
        await db.execute(
            update(TablaNutricional).where(TablaNutricional.id_producto == id_origen).values(id_producto=id_destino)
        )
    else:
        await db.execute(delete(TablaNutricional).where(TablaNutricional.id_producto == id_origen))

    await db.execute(delete(Producto).where(Producto.id_producto == id_origen))
    await db.flush()
    return await _recargar(db, id_destino)
