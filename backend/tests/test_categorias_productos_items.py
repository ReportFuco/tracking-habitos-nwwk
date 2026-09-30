"""Categorías propias, catálogo de productos con aprobación y productos dentro de un gasto.

Cada test corre en una transacción que se revierte al final (base ``*_test``).
"""
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.db.session import AsyncSessionLocal
from app.models import (
    Banco,
    CategoriaFinanza,
    CuentaUsuario,
    EstadoProducto,
    MovimientoItem,
    Producto,
    ProductoFinanciero,
    User,
    Usuario,
)
from app.models.finanzas import EnumTipoGasto, EnumTipoMovimiento
from app.schemas.catalogo import ProductoCreate, ProductoPatch
from app.schemas.finanzas import (
    CategoriaCreate,
    CategoriaPatch,
    MovimientoCreate,
    MovimientoItemCreate,
    MovimientoItemPatch,
    MovimientoPatch,
    MovimientoResponse,
)
from app.services.catalogo import productos
from app.services.errores import Conflicto, NoEncontrado, SinPermiso
from app.services.finanzas import categorias, items, movimientos


async def _escenario(db):
    seed = uuid4().hex[:8]
    auths = [
        User(email=f"cpi_{n}_{seed}@mail.com", hashed_password="x", is_active=True, is_superuser=False, is_verified=False)
        for n in ("a", "b")
    ]
    db.add_all(auths)
    await db.flush()
    perfiles = [
        Usuario(
            auth_user_id=auth.id,
            username=f"cpi_{n}_{seed}",
            nombre="Test",
            apellido=n,
            telefono=f"56{i}{seed[:7]}",
            email=auth.email,
        )
        for i, (n, auth) in enumerate(zip(("a", "b"), auths))
    ]
    banco = Banco(nombre_banco=f"Banco CPI {seed}")
    defecto = CategoriaFinanza(nombre=f"Supermercado {seed}")
    db.add_all([*perfiles, banco, defecto])
    await db.flush()
    producto_fin = ProductoFinanciero(id_banco=banco.id_banco, nombre_producto=f"Cuenta {seed}")
    db.add(producto_fin)
    await db.flush()
    cuentas = [
        CuentaUsuario(
            id_usuario=perfil.id_usuario,
            id_producto_financiero=producto_fin.id_producto_financiero,
            nombre_cuenta=f"Cuenta {perfil.username}",
        )
        for perfil in perfiles
    ]
    db.add_all(cuentas)
    await db.flush()
    return SimpleNamespace(seed=seed, a=perfiles[0], b=perfiles[1], defecto=defecto, cuenta_a=cuentas[0], cuenta_b=cuentas[1])


def _gasto(id_categoria: int, id_cuenta: int, monto: int = 12000, tipo=EnumTipoMovimiento.GASTO) -> MovimientoCreate:
    return MovimientoCreate(
        id_categoria=id_categoria,
        id_cuenta=id_cuenta,
        tipo_movimiento=tipo,
        tipo_gasto=EnumTipoGasto.VARIABLE,
        monto=monto,
    )


@pytest.mark.asyncio(loop_scope="session")
async def test_categorias_propias_son_privadas_y_no_repiten_nombres():
    async with AsyncSessionLocal() as db:
        trans = await db.begin()
        try:
            e = await _escenario(db)

            propia = await categorias.crear_categoria(db, e.a, CategoriaCreate(nombre=f"  Mascotas   {e.seed} "))
            assert propia.nombre == f"Mascotas {e.seed}"
            assert propia.es_propia and propia.id_usuario == e.a.id_usuario

            ids_a = {c.id_categoria for c in await categorias.listar_categorias(db, e.a)}
            ids_b = {c.id_categoria for c in await categorias.listar_categorias(db, e.b)}
            assert {propia.id_categoria, e.defecto.id_categoria} <= ids_a
            assert propia.id_categoria not in ids_b
            assert e.defecto.id_categoria in ids_b

            # Mismo nombre sin distinguir mayúsculas: choca con la propia y con la por defecto.
            with pytest.raises(Conflicto):
                await categorias.crear_categoria(db, e.a, CategoriaCreate(nombre=f"MASCOTAS {e.seed}"))
            with pytest.raises(Conflicto):
                await categorias.crear_categoria(db, e.a, CategoriaCreate(nombre=e.defecto.nombre.lower()))
            # Otro usuario sí puede tener una con el mismo nombre.
            de_b = await categorias.crear_categoria(db, e.b, CategoriaCreate(nombre=f"Mascotas {e.seed}"))
            assert de_b.id_usuario == e.b.id_usuario

            # La de otro usuario no existe para mí: ni para leerla, ni para editarla, ni para usarla.
            with pytest.raises(NoEncontrado):
                await categorias.obtener_categoria(db, e.a, de_b.id_categoria)
            with pytest.raises(NoEncontrado):
                await categorias.actualizar_categoria(db, e.a, de_b.id_categoria, CategoriaPatch(nombre="x"))
            with pytest.raises(NoEncontrado):
                await movimientos.crear_movimiento(db, e.a, _gasto(de_b.id_categoria, e.cuenta_a.id_cuenta))
        finally:
            await trans.rollback()


@pytest.mark.asyncio(loop_scope="session")
async def test_categorias_por_defecto_solo_las_administra_un_superusuario():
    async with AsyncSessionLocal() as db:
        trans = await db.begin()
        try:
            e = await _escenario(db)

            with pytest.raises(SinPermiso):
                await categorias.crear_categoria(db, e.a, CategoriaCreate(nombre=f"Global {e.seed}", por_defecto=True))
            with pytest.raises(SinPermiso):
                await categorias.actualizar_categoria(db, e.a, e.defecto.id_categoria, CategoriaPatch(nombre="x"))
            with pytest.raises(SinPermiso):
                await categorias.eliminar_categoria(db, e.a, e.defecto.id_categoria)

            nueva = await categorias.crear_categoria(
                db, e.a, CategoriaCreate(nombre=f"Global {e.seed}", por_defecto=True), es_admin=True
            )
            assert nueva.id_usuario is None
            assert nueva.id_categoria in {c.id_categoria for c in await categorias.listar_categorias(db, e.b)}

            renombrada = await categorias.actualizar_categoria(
                db, e.a, e.defecto.id_categoria, CategoriaPatch(nombre=f"Super {e.seed}"), es_admin=True
            )
            assert renombrada.nombre == f"Super {e.seed}"
        finally:
            await trans.rollback()


@pytest.mark.asyncio(loop_scope="session")
async def test_categoria_con_movimientos_se_archiva_en_vez_de_borrarse():
    async with AsyncSessionLocal() as db:
        trans = await db.begin()
        try:
            e = await _escenario(db)
            usada = await categorias.crear_categoria(db, e.a, CategoriaCreate(nombre=f"Usada {e.seed}"))
            sin_uso = await categorias.crear_categoria(db, e.a, CategoriaCreate(nombre=f"Sin uso {e.seed}"))
            await movimientos.crear_movimiento(db, e.a, _gasto(usada.id_categoria, e.cuenta_a.id_cuenta))

            assert await categorias.eliminar_categoria(db, e.a, usada.id_categoria) is True
            assert await categorias.eliminar_categoria(db, e.a, sin_uso.id_categoria) is False

            activas = {c.id_categoria for c in await categorias.listar_categorias(db, e.a)}
            todas = {c.id_categoria for c in await categorias.listar_categorias(db, e.a, incluir_archivadas=True)}
            assert usada.id_categoria not in activas
            assert usada.id_categoria in todas
            assert sin_uso.id_categoria not in todas

            # Archivada: no se ofrece para registros nuevos, pero se puede desarchivar.
            with pytest.raises(Conflicto):
                await movimientos.crear_movimiento(db, e.a, _gasto(usada.id_categoria, e.cuenta_a.id_cuenta))
            with pytest.raises(Conflicto):
                await categorias.crear_categoria(db, e.a, CategoriaCreate(nombre=f"usada {e.seed}"))
            restaurada = await categorias.actualizar_categoria(db, e.a, usada.id_categoria, CategoriaPatch(activo=True))
            assert restaurada.activo is True
        finally:
            await trans.rollback()


@pytest.mark.asyncio(loop_scope="session")
async def test_producto_de_usuario_queda_pendiente_hasta_que_se_aprueba():
    async with AsyncSessionLocal() as db:
        trans = await db.begin()
        try:
            e = await _escenario(db)
            nombre = f"Leche Colun {e.seed}"

            propuesta = await productos.crear_producto(
                db, e.a, ProductoCreate(nombre_producto=nombre, contenido_neto=Decimal("1"), unidad_contenido="L")
            )
            assert propuesta.estado == EstadoProducto.PENDIENTE
            assert propuesta.id_usuario_creador == e.a.id_usuario

            visibles_a = await productos.buscar_productos(db, e.a, q=f"leche {e.seed}")
            visibles_b = await productos.buscar_productos(db, e.b, q=f"leche {e.seed}")
            assert [p.id_producto for p in visibles_a] == [propuesta.id_producto]
            assert visibles_b == []
            with pytest.raises(NoEncontrado):
                await productos.obtener_producto(db, e.b, propuesta.id_producto)

            # El creador corrige su propuesta; un usuario no puede tocar la activación.
            editada = await productos.editar_producto(
                db, e.a, propuesta.id_producto, ProductoPatch(formato="Caja")
            )
            assert editada.formato == "Caja"
            with pytest.raises(SinPermiso):
                await productos.editar_producto(db, e.a, propuesta.id_producto, ProductoPatch(activo=False))
            with pytest.raises(NoEncontrado):
                await productos.editar_producto(db, e.b, propuesta.id_producto, ProductoPatch(formato="x"))

            aprobado = await productos.aprobar_producto(db, propuesta.id_producto)
            assert aprobado.estado == EstadoProducto.APROBADO
            assert [p.id_producto for p in await productos.buscar_productos(db, e.b, q=nombre)] == [propuesta.id_producto]

            # Aprobado, ya es del catálogo compartido: solo lo edita el administrador.
            with pytest.raises(SinPermiso):
                await productos.editar_producto(db, e.a, propuesta.id_producto, ProductoPatch(formato="Botella"))
            # Y nadie puede proponer otro con el mismo nombre (sin tildes ni mayúsculas).
            with pytest.raises(Conflicto):
                await productos.crear_producto(db, e.b, ProductoCreate(nombre_producto=nombre.upper()))
        finally:
            await trans.rollback()


@pytest.mark.asyncio(loop_scope="session")
async def test_rechazo_y_codigo_de_barra_duplicado():
    async with AsyncSessionLocal() as db:
        trans = await db.begin()
        try:
            e = await _escenario(db)
            codigo = f"780{e.seed}"

            oficial = await productos.crear_producto(
                db, None, ProductoCreate(nombre_producto=f"Arroz {e.seed}", codigo_barra=codigo), es_admin=True
            )
            assert oficial.estado == EstadoProducto.APROBADO

            with pytest.raises(Conflicto):
                await productos.crear_producto(
                    db, e.a, ProductoCreate(nombre_producto=f"Arroz grado 1 {e.seed}", codigo_barra=codigo)
                )

            # Dos propuestas con el mismo código de usuarios distintos conviven como pendientes,
            # pero la segunda no puede aprobarse: hay que fusionarla.
            propuesta_a = await productos.crear_producto(
                db, e.a, ProductoCreate(nombre_producto=f"Fideos {e.seed}", codigo_barra=f"{codigo}9")
            )
            propuesta_b = await productos.crear_producto(
                db, e.b, ProductoCreate(nombre_producto=f"Fideos spaghetti {e.seed}", codigo_barra=f"{codigo}9")
            )
            await productos.aprobar_producto(db, propuesta_a.id_producto)
            with pytest.raises(Conflicto):
                await productos.aprobar_producto(db, propuesta_b.id_producto)

            rechazada = await productos.rechazar_producto(db, propuesta_b.id_producto)
            assert rechazada.estado == EstadoProducto.RECHAZADO
            # Sigue siendo privada de su creador, y si la corrige vuelve a revisión.
            assert await productos.obtener_producto(db, e.b, propuesta_b.id_producto)
            corregida = await productos.editar_producto(
                db, e.b, propuesta_b.id_producto, ProductoPatch(codigo_barra=f"{codigo}8")
            )
            assert corregida.estado == EstadoProducto.PENDIENTE
            revision = {p.id_producto for p in await productos.listar_para_revision(db)}
            assert propuesta_b.id_producto in revision
        finally:
            await trans.rollback()


@pytest.mark.asyncio(loop_scope="session")
async def test_items_del_gasto_y_fusion_de_duplicados():
    async with AsyncSessionLocal() as db:
        trans = await db.begin()
        try:
            e = await _escenario(db)
            oficial = await productos.crear_producto(
                db, None, ProductoCreate(nombre_producto=f"Pan hallulla {e.seed}", unidad_contenido="kg", contenido_neto=Decimal("1")),
                es_admin=True,
            )
            duplicado = await productos.crear_producto(db, e.a, ProductoCreate(nombre_producto=f"Hallulla {e.seed}"))
            privado_b = await productos.crear_producto(db, e.b, ProductoCreate(nombre_producto=f"Queso {e.seed}"))

            gasto = await movimientos.crear_movimiento(db, e.a, _gasto(e.defecto.id_categoria, e.cuenta_a.id_cuenta))
            con_item = await items.agregar_item(
                db, e.a, gasto.id_transaccion,
                MovimientoItemCreate(id_producto=oficial.id_producto, cantidad=Decimal("0.75"), precio_total=1800),
            )
            con_dos = await items.agregar_item(
                db, e.a, gasto.id_transaccion, MovimientoItemCreate(id_producto=duplicado.id_producto)
            )
            respuesta = MovimientoResponse.model_validate(con_dos)
            assert respuesta.total_detallado == 1800
            assert [i.nombre_producto for i in respuesta.items] == [oficial.nombre_producto, duplicado.nombre_producto]
            assert respuesta.items[0].precio_unitario == 2400
            assert respuesta.items[0].detalle_producto == "1 kg"
            assert respuesta.items[1].estado_producto == EstadoProducto.PENDIENTE
            assert respuesta.id_categoria == e.defecto.id_categoria

            # Aislamiento: ni el gasto ni el producto privado de otro usuario.
            with pytest.raises(NoEncontrado):
                await items.agregar_item(db, e.b, gasto.id_transaccion, MovimientoItemCreate(id_producto=oficial.id_producto))
            with pytest.raises(NoEncontrado):
                await items.agregar_item(db, e.a, gasto.id_transaccion, MovimientoItemCreate(id_producto=privado_b.id_producto))

            # Un ingreso no tiene productos, y un gasto con productos no puede pasar a ingreso.
            ingreso = await movimientos.crear_movimiento(
                db, e.a, _gasto(e.defecto.id_categoria, e.cuenta_a.id_cuenta, tipo=EnumTipoMovimiento.INGRESO)
            )
            with pytest.raises(Conflicto):
                await items.agregar_item(db, e.a, ingreso.id_transaccion, MovimientoItemCreate(id_producto=oficial.id_producto))
            with pytest.raises(Conflicto):
                await movimientos.editar_movimiento(
                    db, e.a, gasto.id_transaccion, MovimientoPatch(tipo_movimiento=EnumTipoMovimiento.INGRESO)
                )

            id_item = con_item.items[0].id_item
            editado = await items.editar_item(
                db, e.a, gasto.id_transaccion, id_item, MovimientoItemPatch(cantidad=Decimal("1"), precio_total=None)
            )
            assert MovimientoResponse.model_validate(editado).total_detallado == 0

            frecuentes = await productos.productos_frecuentes(db, e.a)
            assert {p.id_producto for p in frecuentes} == {oficial.id_producto, duplicado.id_producto}

            # Fusionar el duplicado: el ítem pasa al oficial y el duplicado desaparece.
            await productos.fusionar_producto(db, duplicado.id_producto, oficial.id_producto)
            recargado = await movimientos.obtener_movimiento(db, e.a, gasto.id_transaccion)
            assert [i.id_producto for i in recargado.items] == [oficial.id_producto, oficial.id_producto]
            assert await db.get(Producto, duplicado.id_producto) is None

            # El destino de una fusión tiene que ser del catálogo aprobado.
            with pytest.raises(Conflicto):
                await productos.fusionar_producto(db, oficial.id_producto, privado_b.id_producto)

            restante = await items.eliminar_item(db, e.a, gasto.id_transaccion, id_item)
            assert len(restante.items) == 1

            # Borrar el gasto borra sus productos detallados.
            id_restante = restante.items[0].id_item
            await db.delete(await db.get(type(gasto), gasto.id_transaccion))
            await db.flush()
            db.expunge_all()
            assert await db.get(MovimientoItem, id_restante) is None
        finally:
            await trans.rollback()
