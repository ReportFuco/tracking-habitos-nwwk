from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.db.session import AsyncSessionLocal
from app.models import User, Usuario
from app.routes.usuarios.usuario import (
    eliminar_usuario_soft,
    obtener_mi_perfil,
    obtener_usuarios,
)
from app.schemas.usuario import UsuarioPerfilResponse, UsuarioResponse


async def _crear_usuario(db, seed: str, *, is_superuser: bool = False, is_active: bool = True):
    auth = User(
        email=f"perfil_{seed}@mail.com",
        hashed_password="x",
        is_active=is_active,
        is_superuser=is_superuser,
        is_verified=False,
    )
    db.add(auth)
    await db.flush()

    perfil = Usuario(
        auth_user_id=auth.id,
        username=f"perfil_{seed}",
        nombre="Perfil",
        apellido="Test",
        telefono=f"569{seed[:8]}",
        email=auth.email,
    )
    db.add(perfil)
    await db.flush()

    return perfil, SimpleNamespace(id=auth.id)


@pytest.mark.asyncio(loop_scope="session")
async def test_mi_perfil_incluye_is_active_e_is_superuser():
    async with AsyncSessionLocal() as db:
        trans = await db.begin()
        try:
            seed = uuid4().hex[:8]
            _, user = await _crear_usuario(db, seed, is_superuser=True)

            # La ruta devuelve el objeto ORM tal cual; response_model solo actua en la
            # capa HTTP real, asi que se valida a mano para ejercitar el mismo
            # aplanado de is_active/is_superuser que haria FastAPI.
            perfil = UsuarioPerfilResponse.model_validate(
                await obtener_mi_perfil(user=user, db=db)
            )

            assert perfil.is_active is True
            assert perfil.is_superuser is True
        finally:
            await trans.rollback()


@pytest.mark.asyncio(loop_scope="session")
async def test_listado_usuarios_refleja_is_active_e_is_superuser_por_fila():
    async with AsyncSessionLocal() as db:
        trans = await db.begin()
        try:
            seed = uuid4().hex[:8]
            _, admin_user = await _crear_usuario(db, f"a{seed}", is_superuser=True)
            perfil_normal, _ = await _crear_usuario(
                db, f"n{seed}", is_superuser=False, is_active=False
            )

            usuarios = [
                UsuarioResponse.model_validate(u)
                for u in await obtener_usuarios(db=db, user=admin_user)
            ]
            por_id = {u.id_usuario: u for u in usuarios}

            # La fila del usuario normal no debe heredar el is_superuser del admin que
            # pide el listado -- ese fue justo el bug: is_active/is_superuser faltaban
            # en UsuarioResponse, y de haberse rellenado con el usuario de la sesion en
            # vez de por fila, todos habrian aparecido como superusuarios activos.
            assert por_id[perfil_normal.id_usuario].is_superuser is False
            assert por_id[perfil_normal.id_usuario].is_active is False
        finally:
            await trans.rollback()


@pytest.mark.asyncio(loop_scope="session")
async def test_desactivar_usuario_usa_el_id_de_usuario_no_el_de_auth():
    async with AsyncSessionLocal() as db:
        trans = await db.begin()
        try:
            seed = uuid4().hex[:8]
            _, admin_user = await _crear_usuario(db, f"a{seed}", is_superuser=True)
            perfil_objetivo, _ = await _crear_usuario(db, f"n{seed}")

            # id_usuario es el PK de usuarios.usuario -- justo lo que manda el frontend
            # (usuarios-admin-manager.tsx) y distinto del id de auth.user. Si la ruta
            # todavia filtrara por User.id como antes, este id no matchearia con nadie y
            # tiraria 404 en vez de desactivar a quien corresponde.
            await eliminar_usuario_soft(
                id_usuario=perfil_objetivo.id_usuario,
                db=db,
                user=admin_user,
            )

            assert perfil_objetivo.user.is_active is False
        finally:
            await trans.rollback()


@pytest.mark.asyncio(loop_scope="session")
async def test_desactivar_usuario_ya_inactivo_da_404():
    async with AsyncSessionLocal() as db:
        trans = await db.begin()
        try:
            seed = uuid4().hex[:8]
            _, admin_user = await _crear_usuario(db, f"a{seed}", is_superuser=True)
            perfil_objetivo, _ = await _crear_usuario(db, f"n{seed}", is_active=False)

            with pytest.raises(HTTPException) as exc:
                await eliminar_usuario_soft(
                    id_usuario=perfil_objetivo.id_usuario,
                    db=db,
                    user=admin_user,
                )
            assert exc.value.status_code == 404
        finally:
            await trans.rollback()
