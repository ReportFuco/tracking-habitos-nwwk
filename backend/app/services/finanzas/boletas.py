"""Detalle de una boleta completa dentro de un gasto.

Solo existe por MCP: el modelo conectado lee la foto de la boleta y manda todas sus líneas
de una vez. Cada línea se resuelve a un producto del catálogo, en este orden:

1. ``id_producto`` explícito.
2. Una boleta anterior del usuario con el mismo texto (``MovimientoItem.descripcion_boleta``)
   o, si la línea trae un EAN, el código de barra.
3. Un producto igual a ``producto_nuevo`` que ya exista (mismo nombre, marca y variante).
4. ``producto_nuevo``: se crea en el catálogo. Como crear_producto, solo un administrador.

Primero se revisa sin guardar y, con el visto bueno del usuario, se guarda todo en la misma
transacción: o queda la boleta completa o nada.
"""
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from sqlalchemy import delete, desc, exists, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.texto import normalize_search_text, normalize_sql_text
from app.models import (
    CategoriaProducto,
    CuentaUsuario,
    Marca,
    Movimiento,
    MovimientoItem,
    Producto,
    Usuario,
)
from app.models.finanzas import EnumTipoMovimiento
from app.schemas.catalogo import ProductoCreate
from app.schemas.finanzas import (
    LineaBoleta,
    LineaBoletaRevisada,
    ProductoNuevoBoleta,
    RevisionBoleta,
    SugerenciaProducto,
)
from app.services.catalogo import productos
from app.services.errores import Conflicto, DatosInvalidos, NoEncontrado
from app.services.finanzas import categorias, items, movimientos


# Solo un EAN/UPC se compara con el código de barra: los códigos internos de cada
# supermercado podrían coincidir por azar con el de otro producto.
_EAN = re.compile(r"\d{8}|\d{12,14}")


@dataclass
class _Linea:
    estado: str
    producto: Producto | None = None
    nuevo: ProductoNuevoBoleta | None = None
    error: str | None = None
    sugerencias: list[Producto] = field(default_factory=list)


def nombre_con_marca(nombre: str, marca: str | None) -> str:
    return f"{nombre} ({marca})" if marca else nombre


def _clave_nuevo(nuevo: ProductoNuevoBoleta) -> tuple:
    def norm(valor):
        return normalize_search_text(valor) if valor else None

    contenido = nuevo.contenido_neto.normalize() if nuevo.contenido_neto is not None else None
    return norm(nuevo.nombre), norm(nuevo.marca), contenido, norm(nuevo.unidad_contenido), norm(nuevo.sabor)


async def _por_boleta_anterior(db: AsyncSession, usuario: Usuario, texto: str) -> Producto | None:
    """El producto con que el usuario detalló por última vez una línea con este texto."""
    id_producto = await db.scalar(
        select(MovimientoItem.id_producto)
        .join(Movimiento, MovimientoItem.id_movimiento == Movimiento.id_transaccion)
        .join(CuentaUsuario, Movimiento.id_cuenta == CuentaUsuario.id_cuenta)
        .join(Producto, MovimientoItem.id_producto == Producto.id_producto)
        .where(
            CuentaUsuario.id_usuario == usuario.id_usuario,
            normalize_sql_text(MovimientoItem.descripcion_boleta) == normalize_search_text(texto),
            Producto.activo.is_(True),
            productos.condicion_visible(usuario),
        )
        .order_by(desc(MovimientoItem.id_item))
        .limit(1)
    )
    return await productos.obtener_producto(db, usuario, id_producto) if id_producto else None


async def _por_codigo(db: AsyncSession, usuario: Usuario, codigo: str | None) -> Producto | None:
    if not codigo or not _EAN.fullmatch(codigo):
        return None
    producto = await db.scalar(
        select(Producto.id_producto)
        .where(
            Producto.codigo_barra == codigo,
            Producto.activo.is_(True),
            productos.condicion_visible(usuario),
        )
        .limit(1)
    )
    return await productos.obtener_producto(db, usuario, producto) if producto else None


async def _por_nombre(db: AsyncSession, nombre: str, modelo, columna):
    return await db.scalar(
        select(modelo).where(normalize_sql_text(columna) == normalize_search_text(nombre)).limit(1)
    )


async def _igual_existente(db: AsyncSession, usuario: Usuario, nuevo: ProductoNuevoBoleta) -> Producto | None:
    id_marca = None
    if nuevo.marca:
        marca = await _por_nombre(db, nuevo.marca, Marca, Marca.nombre_marca)
        if marca is None:
            # Marca que no existe: ningún producto del catálogo puede ser igual.
            return None
        id_marca = marca.id_marca
    return await productos.buscar_igual(
        db,
        usuario,
        nombre=nuevo.nombre,
        id_marca=id_marca,
        contenido_neto=nuevo.contenido_neto,
        unidad_contenido=nuevo.unidad_contenido,
        sabor=nuevo.sabor,
    )


async def _sugerencias(db: AsyncSession, usuario: Usuario, texto: str) -> list[Producto]:
    # La búsqueda exige que calce cada palabra, y las boletas abrevian ("LECHE ENT COLUN
    # 1L"): se busca solo con las palabras largas, que suelen venir completas.
    palabras = [palabra for palabra in texto.split() if len(palabra) >= 4 and not palabra.isdigit()]
    if not palabras:
        return []
    return await productos.buscar_productos(db, usuario, q=" ".join(palabras), limit=3)


async def _resolver(db: AsyncSession, usuario: Usuario, linea: LineaBoleta, *, es_admin: bool) -> _Linea:
    if linea.id_producto is not None:
        try:
            await movimientos.validar_producto_activo(db, usuario, linea.id_producto)
        except (Conflicto, NoEncontrado) as exc:
            return _Linea("invalida", error=exc.mensaje)
        return _Linea("elegido", producto=await productos.obtener_producto(db, usuario, linea.id_producto))

    nuevo = linea.producto_nuevo
    reconocido = (
        await _por_boleta_anterior(db, usuario, linea.texto)
        or await _por_codigo(db, usuario, linea.codigo)
        or (nuevo and await _por_codigo(db, usuario, nuevo.codigo_barra))
        or (nuevo and await _igual_existente(db, usuario, nuevo))
    )
    if reconocido:
        return _Linea("reconocido", producto=reconocido)
    if nuevo is not None:
        if not es_admin:
            return _Linea(
                "invalida",
                error="Solo un administrador puede agregar productos al catálogo: pídeselo o quita la línea.",
            )
        return _Linea("nuevo", nuevo=nuevo)
    return _Linea(
        "sin_producto",
        error="Indica id_producto (ver buscar_productos) o producto_nuevo.",
        sugerencias=await _sugerencias(db, usuario, linea.texto),
    )


async def _obtener_o_crear(db: AsyncSession, nombre: str | None, modelo, columna, campo: str):
    if not nombre:
        return None
    existente = await _por_nombre(db, nombre, modelo, columna)
    if existente is None:
        existente = modelo(**{campo: nombre})
        db.add(existente)
        await db.flush()
    return existente


async def _crear_producto(db: AsyncSession, usuario: Usuario, nuevo: ProductoNuevoBoleta) -> Producto:
    marca = await _obtener_o_crear(db, nuevo.marca, Marca, Marca.nombre_marca, "nombre_marca")
    categoria = await _obtener_o_crear(
        db, nuevo.categoria, CategoriaProducto, CategoriaProducto.nombre_categoria, "nombre_categoria"
    )
    data = ProductoCreate(
        nombre_producto=nuevo.nombre,
        id_marca=marca.id_marca if marca else None,
        id_categoria=categoria.id_categoria if categoria else None,
        contenido_neto=nuevo.contenido_neto,
        unidad_contenido=nuevo.unidad_contenido,
        formato=nuevo.formato,
        sabor=nuevo.sabor,
        codigo_barra=nuevo.codigo_barra,
    )
    return await productos.crear_producto(db, usuario, data, es_admin=True)


async def detallar_boleta(
    db: AsyncSession,
    usuario: Usuario,
    id_movimiento: int,
    lineas: list[LineaBoleta],
    *,
    comercio: str | None = None,
    reemplazar: bool = False,
    confirmar: bool = False,
    es_admin: bool = False,
) -> RevisionBoleta:
    """Revisa las líneas de una boleta y, con ``confirmar``, las guarda como productos del
    gasto. Sin confirmar no escribe nada (ni productos, ni marcas, ni el comercio)."""
    movimiento = await items.gasto_del_usuario(db, usuario, id_movimiento)
    detalle_previo = await db.scalar(
        select(func.count(MovimientoItem.id_item)).where(MovimientoItem.id_movimiento == id_movimiento)
    )
    comercio = await movimientos.normalizar_comercio(db, usuario, comercio) or movimiento.comercio

    resueltas = [await _resolver(db, usuario, linea, es_admin=es_admin) for linea in lineas]
    nuevos = {_clave_nuevo(r.nuevo) for r in resueltas if r.estado == "nuevo"}

    if confirmar:
        problemas = [
            f"{indice} ({r.error})" for indice, r in enumerate(resueltas) if r.estado in ("invalida", "sin_producto")
        ]
        if problemas:
            raise DatosInvalidos(f"No se guardó nada. Revisa las líneas: {'; '.join(problemas)}.")
        if detalle_previo and not reemplazar:
            raise Conflicto(
                f"El gasto ya tiene {detalle_previo} productos detallados: usa reemplazar=true para "
                "cambiarlos por los de esta boleta."
            )
        if detalle_previo:
            await db.execute(delete(MovimientoItem).where(MovimientoItem.id_movimiento == id_movimiento))

        # Dos líneas con el mismo producto nuevo (se pasó dos veces por caja) crean uno solo.
        creados: dict[tuple, Producto] = {}
        for resuelta in resueltas:
            if resuelta.estado == "nuevo":
                clave = _clave_nuevo(resuelta.nuevo)
                if clave not in creados:
                    creados[clave] = await _crear_producto(db, usuario, resuelta.nuevo)
                resuelta.producto = creados[clave]
        for linea, resuelta in zip(lineas, resueltas):
            db.add(MovimientoItem(
                id_movimiento=id_movimiento,
                id_producto=resuelta.producto.id_producto,
                cantidad=linea.cantidad,
                precio_total=linea.precio_total,
                descuento=linea.descuento or None,
                descripcion_boleta=linea.texto,
            ))
        movimiento.comercio = comercio
        await db.flush()

    revisadas = []
    for indice, (linea, resuelta) in enumerate(zip(lineas, resueltas)):
        if resuelta.producto is not None:
            nombre = nombre_con_marca(resuelta.producto.nombre_producto, resuelta.producto.nombre_marca)
        elif resuelta.nuevo is not None:
            nombre = nombre_con_marca(resuelta.nuevo.nombre, resuelta.nuevo.marca)
        else:
            nombre = None
        revisadas.append(LineaBoletaRevisada(
            indice=indice,
            texto=linea.texto,
            estado=resuelta.estado,
            id_producto=resuelta.producto.id_producto if resuelta.producto else None,
            producto=nombre,
            cantidad=float(linea.cantidad),
            precio_total=linea.precio_total,
            descuento=linea.descuento,
            error=resuelta.error,
            sugerencias=[
                SugerenciaProducto(
                    id_producto=producto.id_producto,
                    producto=nombre_con_marca(producto.nombre_producto, producto.nombre_marca),
                )
                for producto in resuelta.sugerencias
            ],
        ))

    total = sum(linea.precio_total for linea in lineas)
    return RevisionBoleta(
        aplicado=confirmar,
        id_movimiento=id_movimiento,
        comercio=comercio,
        monto_gasto=movimiento.monto,
        total_lineas=total,
        diferencia=movimiento.monto - total,
        descuentos=sum(linea.descuento for linea in lineas),
        productos_nuevos=len(nuevos),
        detalle_previo=detalle_previo,
        lineas=revisadas,
    )


async def gastos_por_detallar(
    db: AsyncSession,
    usuario: Usuario,
    *,
    dias: int = 14,
    id_categoria: int | None = None,
    limit: int = 20,
) -> list[Movimiento]:
    """Gastos recientes sin productos detallados, en las categorías que piden detalle (o en
    ``id_categoria``). Más recientes primero. Omite transferencias y abonos a deudas."""
    if id_categoria is not None:
        await categorias.obtener_categoria(db, usuario, id_categoria)
        ids_categoria = [id_categoria]
    else:
        ids_categoria = [
            categoria.id_categoria
            for categoria in await categorias.listar_categorias(
                db, usuario, incluir_archivadas=True, incluir_ocultas=True
            )
            if categoria.pedir_detalle
        ]
    if not ids_categoria:
        return []

    desde = datetime.combine(datetime.now(movimientos.CHILE_TZ).date() - timedelta(days=dias), datetime.min.time())
    return (
        await db.execute(
            select(Movimiento)
            .join(CuentaUsuario, Movimiento.id_cuenta == CuentaUsuario.id_cuenta)
            .where(
                CuentaUsuario.id_usuario == usuario.id_usuario,
                Movimiento.tipo_movimiento == EnumTipoMovimiento.GASTO,
                Movimiento.id_transferencia.is_(None),
                Movimiento.id_deuda.is_(None),
                Movimiento.id_categoria.in_(ids_categoria),
                Movimiento.created_at >= desde,
                ~exists().where(MovimientoItem.id_movimiento == Movimiento.id_transaccion),
            )
            .order_by(desc(Movimiento.created_at), desc(Movimiento.id_transaccion))
            .limit(limit)
            .options(*movimientos.opciones_detalle())
        )
    ).scalars().all()


async def comercios_usados(db: AsyncSession, usuario: Usuario, limit: int = 20) -> list[str]:
    """Comercios que el usuario ya registró, los más usados primero, para escribirlos igual."""
    filas = await db.execute(
        select(Movimiento.comercio)
        .join(CuentaUsuario, Movimiento.id_cuenta == CuentaUsuario.id_cuenta)
        .where(CuentaUsuario.id_usuario == usuario.id_usuario, Movimiento.comercio.is_not(None))
        .group_by(Movimiento.comercio)
        .order_by(desc(func.count()), Movimiento.comercio)
        .limit(limit)
    )
    return list(filas.scalars().all())
