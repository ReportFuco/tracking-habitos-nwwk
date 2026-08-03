from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.db.session import AsyncSessionLocal
from app.models import Marca
from app.routes.catalogo.producto import crear_producto, editar_producto, obtener_productos
from app.schemas.catalogo import ProductoCreate, ProductoPatch, ProductoResponse


@pytest.mark.asyncio(loop_scope="session")
async def test_producto_response_incluye_nombre_marca():
    async with AsyncSessionLocal() as db:
        trans = await db.begin()
        try:
            seed = uuid4().hex[:8]
            marca = Marca(nombre_marca=f"Marca {seed}")
            db.add(marca)
            await db.flush()

            user = SimpleNamespace(id=1)
            creado = await crear_producto(
                data=ProductoCreate(
                    id_marca=marca.id_marca,
                    nombre_producto=f"Producto {seed}",
                    codigo_barra=f"780{seed}",
                ),
                db=db,
                user=user,
            )

            # A diferencia de categoria/subcategoria, nombre_marca nunca se calculaba (ni
            # el modelo tenia la property ni las rutas cargaban la relacion) -- por eso se
            # valida a mano contra el schema, igual que las rutas que devuelven el objeto
            # ORM crudo sin pasar por FastAPI.
            respuesta = ProductoResponse.model_validate(creado)
            assert respuesta.nombre_marca == f"Marca {seed}"

            listado = [
                ProductoResponse.model_validate(p)
                for p in await obtener_productos(db=db, user=user)
            ]
            producto_listado = next(p for p in listado if p.id_producto == creado.id_producto)
            assert producto_listado.nombre_marca == f"Marca {seed}"
        finally:
            await trans.rollback()


@pytest.mark.asyncio(loop_scope="session")
async def test_producto_sin_marca_ni_codigo_barra():
    # id_marca y codigo_barra pasaron a ser opcionales (form de catalogo los muestra como
    # "Opcional" pero el backend los exigia) -- confirma que crear/editar sin ninguno de
    # los dos no dispara los chequeos de "marca no encontrada" / "codigo duplicado", que
    # comparaban contra None sin guardar.
    async with AsyncSessionLocal() as db:
        trans = await db.begin()
        try:
            seed = uuid4().hex[:8]
            user = SimpleNamespace(id=1)

            primero = await crear_producto(
                data=ProductoCreate(nombre_producto=f"Producto A {seed}"),
                db=db,
                user=user,
            )
            segundo = await crear_producto(
                data=ProductoCreate(nombre_producto=f"Producto B {seed}"),
                db=db,
                user=user,
            )

            respuesta_primero = ProductoResponse.model_validate(primero)
            respuesta_segundo = ProductoResponse.model_validate(segundo)
            assert respuesta_primero.id_marca is None
            assert respuesta_primero.codigo_barra is None
            assert respuesta_segundo.id_marca is None
            assert respuesta_segundo.codigo_barra is None

            editado = await editar_producto(
                id_producto=primero.id_producto,
                data=ProductoPatch(codigo_barra=f"780{seed}"),
                db=db,
                user=user,
            )
            assert ProductoResponse.model_validate(editado).codigo_barra == f"780{seed}"
        finally:
            await trans.rollback()
