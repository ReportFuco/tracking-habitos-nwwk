from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.db.session import AsyncSessionLocal
from app.models import Producto
from app.routes.nutricion.tabla_nutricional import crear_tabla, obtener_tablas
from app.schemas.nutricion import TablaNutricionalCreate, TablaNutricionalResponse


@pytest.mark.asyncio(loop_scope="session")
async def test_tabla_response_incluye_nombre_producto():
    # TablaNutricionalResponse declaraba nombre_producto pero el modelo no tenia la
    # property ni la ruta cargaba la relacion -- el frontend (tabla-manager.tsx,
    # tablas-admin-manager.tsx) lee ese campo para buscar/mostrar y siempre recibia
    # undefined. Se valida a mano contra el schema porque la ruta devuelve el objeto ORM
    # crudo cuando se llama directamente (sin pasar por FastAPI).
    async with AsyncSessionLocal() as db:
        trans = await db.begin()
        try:
            seed = uuid4().hex[:8]
            producto = Producto(nombre_producto=f"Producto {seed}")
            db.add(producto)
            await db.flush()

            user = SimpleNamespace(id=1)
            creada = await crear_tabla(
                data=TablaNutricionalCreate(id_producto=producto.id_producto),
                db=db,
                user=user,
            )

            respuesta = TablaNutricionalResponse.model_validate(creada)
            assert respuesta.nombre_producto == f"Producto {seed}"

            listado = [
                TablaNutricionalResponse.model_validate(t)
                for t in await obtener_tablas(db=db, user=user)
            ]
            tabla_listada = next(t for t in listado if t.id_tabla == creada.id_tabla)
            assert tabla_listada.nombre_producto == f"Producto {seed}"
        finally:
            await trans.rollback()
