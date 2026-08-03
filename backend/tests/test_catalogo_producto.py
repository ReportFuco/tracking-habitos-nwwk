from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.db.session import AsyncSessionLocal
from app.models import Marca
from app.routes.catalogo.producto import crear_producto, obtener_productos
from app.schemas.catalogo import ProductoCreate, ProductoResponse


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
