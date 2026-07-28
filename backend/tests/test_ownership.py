from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.db.session import AsyncSessionLocal
from app.models import Banco, Cadena, CategoriaFinanza, Local, Marca, Producto, ProductoFinanciero, User, Usuario
from app.models.finanzas import EnumTipoGasto, EnumTipoMovimiento
from app.routes.finanzas.analitica import (
    obtener_distribucion_categorias,
    obtener_distribucion_cuentas,
    obtener_resumen_financiero,
    obtener_tendencia_mensual,
)
from app.routes.finanzas.cuentas import crear_cuenta_usuario, obtener_cuentas_usuario
from app.routes.finanzas.cuentas import obtener_movimientos_cuenta
from app.routes.finanzas.movimientos import crear_movimiento, obtener_movimientos
from app.routes.finanzas.movimientos import obtener_movimiento
from app.routes.compras.compra import crear_compra_completa, obtener_compra
from app.routes.compras.movimiento_compra import crear_vinculo_movimiento_compra, obtener_vinculos_movimiento_compra
from app.routes.usuarios.usuario import editar_usuario
from app.schemas.compras import CompraCompletaCreate, CompraCreate, MovimientoCompraCreate
from app.schemas.finanzas import CuentaUsuarioCreate, CuentaUsuarioMovimientosResponse, MovimientoCreate
from app.routes.compras.compra import crear_compra
from app.schemas.usuario import UsuarioPatchSchema
from calendar import monthrange
from datetime import datetime
from zoneinfo import ZoneInfo


@pytest.mark.asyncio(loop_scope="session")
async def test_ownership_finanzas_usuarios_end_to_end():
    async with AsyncSessionLocal() as db:
        trans = await db.begin()
        try:
            seed = uuid4().hex[:8]

            # ruido para desalinear user.id vs usuario.id_usuario
            ruido = User(
                email=f"ruido_{seed}@mail.com",
                hashed_password="x",
                is_active=True,
                is_superuser=False,
                is_verified=False,
            )
            db.add(ruido)
            await db.flush()

            auth1 = User(
                email=f"u1_{seed}@mail.com",
                hashed_password="x",
                is_active=True,
                is_superuser=False,
                is_verified=False,
            )
            auth2 = User(
                email=f"u2_{seed}@mail.com",
                hashed_password="x",
                is_active=True,
                is_superuser=False,
                is_verified=False,
            )
            db.add_all([auth1, auth2])
            await db.flush()

            perfil1 = Usuario(
                auth_user_id=auth1.id,
                username=f"u1_{seed}",
                nombre="User",
                apellido="One",
                telefono=f"5691{seed[:6]}",
                email=auth1.email,
            )
            perfil2 = Usuario(
                auth_user_id=auth2.id,
                username=f"u2_{seed}",
                nombre="User",
                apellido="Two",
                telefono=f"5692{seed[:6]}",
                email=auth2.email,
            )
            db.add_all([perfil1, perfil2])
            await db.flush()

            banco = Banco(nombre_banco=f"Banco Test {seed}")
            categoria = CategoriaFinanza(nombre=f"categoria_{seed}")
            db.add_all([banco, categoria])
            await db.flush()

            producto = ProductoFinanciero(
                id_banco=banco.id_banco,
                nombre_producto=f"Cuenta Vista {seed}",
            )
            db.add(producto)
            await db.flush()

            user1 = SimpleNamespace(id=auth1.id)
            user2 = SimpleNamespace(id=auth2.id)

            cuenta = await crear_cuenta_usuario(
                data=CuentaUsuarioCreate(
                    id_producto_financiero=producto.id_producto_financiero,
                    nombre_cuenta=f"Cuenta {seed}",
                ),
                db=db,
                user=user1,
            )
            assert cuenta.id_usuario == perfil1.id_usuario

            with pytest.raises(HTTPException) as exc_cuentas:
                await obtener_cuentas_usuario(user=user2, db=db)
            assert exc_cuentas.value.status_code == 404

            mov = await crear_movimiento(
                data=MovimientoCreate(
                    id_categoria=categoria.id_categoria,
                    id_cuenta=cuenta.id_cuenta,
                    tipo_movimiento=EnumTipoMovimiento.GASTO,
                    tipo_gasto=EnumTipoGasto.VARIABLE,
                    monto=12345,
                    descripcion="test ownership",
                ),
                db=db,
                user=user1,
            )
            assert mov.id_cuenta == cuenta.id_cuenta

            with pytest.raises(HTTPException) as exc_mov:
                await obtener_movimientos(
                    id_movimiento=mov.id_transaccion,
                    db=db,
                    user=user2,
                )
            assert exc_mov.value.status_code == 404

            nuevo_username = f"u1_edit_{seed}"
            actualizado = await editar_usuario(
                data=UsuarioPatchSchema(username=nuevo_username),
                db=db,
                user=user1,
            )
            assert actualizado.id_usuario == perfil1.id_usuario
            assert actualizado.username == nuevo_username
        finally:
            await trans.rollback()


@pytest.mark.asyncio(loop_scope="session")
async def test_movimiento_compra_flow_and_ownership():
    async with AsyncSessionLocal() as db:
        trans = await db.begin()
        try:
            seed = uuid4().hex[:8]

            auth1 = User(
                email=f"mc_u1_{seed}@mail.com",
                hashed_password="x",
                is_active=True,
                is_superuser=False,
                is_verified=False,
            )
            auth2 = User(
                email=f"mc_u2_{seed}@mail.com",
                hashed_password="x",
                is_active=True,
                is_superuser=False,
                is_verified=False,
            )
            db.add_all([auth1, auth2])
            await db.flush()

            perfil1 = Usuario(
                auth_user_id=auth1.id,
                username=f"mc_u1_{seed}",
                nombre="User",
                apellido="One",
                telefono=f"5681{seed[:6]}",
                email=auth1.email,
            )
            perfil2 = Usuario(
                auth_user_id=auth2.id,
                username=f"mc_u2_{seed}",
                nombre="User",
                apellido="Two",
                telefono=f"5682{seed[:6]}",
                email=auth2.email,
            )
            db.add_all([perfil1, perfil2])
            await db.flush()

            banco = Banco(nombre_banco=f"Banco MC {seed}")
            categoria = CategoriaFinanza(nombre=f"categoria_mc_{seed}")
            cadena = Cadena(nombre_cadena=f"Cadena MC {seed}")
            marca = Marca(nombre_marca=f"Marca MC {seed}")
            db.add_all([banco, categoria, cadena, marca])
            await db.flush()

            local = Local(id_cadena=None, nombre_local=f"Almacen {seed}")
            db.add(local)
            await db.flush()

            producto_financiero = ProductoFinanciero(
                id_banco=banco.id_banco,
                nombre_producto=f"Cuenta MC {seed}",
            )
            producto = Producto(
                id_marca=marca.id_marca,
                nombre_producto=f"Producto MC {seed}",
                codigo_barra=f"7799{seed[:8]}",
            )
            db.add(producto_financiero)
            db.add(producto)
            await db.flush()

            user1 = SimpleNamespace(id=auth1.id)
            user2 = SimpleNamespace(id=auth2.id)

            cuenta = await crear_cuenta_usuario(
                data=CuentaUsuarioCreate(
                    id_producto_financiero=producto_financiero.id_producto_financiero,
                    nombre_cuenta=f"Cuenta MC {seed}",
                ),
                db=db,
                user=user1,
            )

            movimiento = await crear_movimiento(
                data=MovimientoCreate(
                    id_categoria=categoria.id_categoria,
                    id_cuenta=cuenta.id_cuenta,
                    tipo_movimiento=EnumTipoMovimiento.GASTO,
                    tipo_gasto=EnumTipoGasto.VARIABLE,
                    monto=2500,
                    descripcion="compra almacen",
                ),
                db=db,
                user=user1,
            )

            compra = await crear_compra_completa(
                data=CompraCompletaCreate(
                    id_local=local.id_local,
                    fecha_compra=movimiento.created_at,
                    id_movimiento=movimiento.id_transaccion,
                    detalles=[
                        {
                            "id_producto": producto.id_producto,
                            "cantidad_comprada": "1.00",
                            "unidad_compra": "unidad",
                            "precio_unitario": "2500.00",
                            "precio_total": "2500.00",
                            "cantidad_unidades": 1,
                        }
                    ],
                ),
                db=db,
                user=user1,
            )

            assert sum(detalle.precio_total for detalle in compra.detalles) == 2500
            assert len(compra.vinculos_movimiento) == 1
            assert compra.local.nombre_local == local.nombre_local
            assert compra.local.cadena is None

            movimiento_detalle = await obtener_movimientos(
                id_movimiento=movimiento.id_transaccion,
                db=db,
                user=user1,
            )
            assert len(movimiento_detalle.vinculos_compra) == 1
            assert movimiento_detalle.vinculos_compra[0].compra.id_compra == compra.id_compra

            compra_manual = await crear_compra(
                data=CompraCreate(id_local=local.id_local, fecha_compra=movimiento.created_at),
                db=db,
                user=user1,
            )

            vinculo = await crear_vinculo_movimiento_compra(
                data=MovimientoCompraCreate(
                    id_movimiento=movimiento.id_transaccion,
                    id_compra=compra_manual.id_compra,
                    monto_asociado="1000.00",
                ),
                db=db,
                user=user1,
            )
            assert vinculo.id_movimiento == movimiento.id_transaccion
            assert vinculo.id_compra == compra_manual.id_compra

            vinculos = await obtener_vinculos_movimiento_compra(
                id_movimiento=movimiento.id_transaccion,
                id_compra=None,
                db=db,
                user=user1,
            )
            assert len(vinculos) == 2

            with pytest.raises(HTTPException) as exc_dup:
                await crear_vinculo_movimiento_compra(
                    data=MovimientoCompraCreate(
                        id_movimiento=movimiento.id_transaccion,
                        id_compra=compra_manual.id_compra,
                    ),
                    db=db,
                    user=user1,
                )
            assert exc_dup.value.status_code == 409

            with pytest.raises(HTTPException) as exc_ajeno:
                await obtener_compra(
                    id_compra=compra.id_compra,
                    db=db,
                    user=user2,
                )
            assert exc_ajeno.value.status_code == 404

            with pytest.raises(HTTPException) as exc_vinculo_ajeno:
                await crear_vinculo_movimiento_compra(
                    data=MovimientoCompraCreate(
                        id_movimiento=movimiento.id_transaccion,
                        id_compra=compra.id_compra,
                    ),
                    db=db,
                    user=user2,
                )
            assert exc_vinculo_ajeno.value.status_code == 404
        finally:
            await trans.rollback()


@pytest.mark.asyncio(loop_scope="session")
async def test_movimientos_list_paginates_and_orders_by_newest_date():
    async with AsyncSessionLocal() as db:
        trans = await db.begin()
        try:
            seed = uuid4().hex[:8]

            auth = User(
                email=f"mov_{seed}@mail.com",
                hashed_password="x",
                is_active=True,
                is_superuser=False,
                is_verified=False,
            )
            db.add(auth)
            await db.flush()

            perfil = Usuario(
                auth_user_id=auth.id,
                username=f"mov_{seed}",
                nombre="Mov",
                apellido="Test",
                telefono=f"5671{seed[:6]}",
                email=auth.email,
            )
            db.add(perfil)
            await db.flush()

            banco = Banco(nombre_banco=f"Banco Pag {seed}")
            categoria = CategoriaFinanza(nombre=f"categoria_pag_{seed}")
            db.add_all([banco, categoria])
            await db.flush()

            producto = ProductoFinanciero(
                id_banco=banco.id_banco,
                nombre_producto=f"Cuenta Pag {seed}",
            )
            db.add(producto)
            await db.flush()

            user = SimpleNamespace(id=auth.id)

            cuenta = await crear_cuenta_usuario(
                data=CuentaUsuarioCreate(
                    id_producto_financiero=producto.id_producto_financiero,
                    nombre_cuenta=f"Cuenta Pag {seed}",
                ),
                db=db,
                user=user,
            )

            chile_now = datetime.now(ZoneInfo("America/Santiago")).replace(tzinfo=None)
            month_start = chile_now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            if month_start.month == 1:
                previous_month = month_start.replace(year=month_start.year - 1, month=12, day=20)
            else:
                previous_month = month_start.replace(month=month_start.month - 1, day=20)

            movimientos_seed = [
                (datetime(month_start.year, month_start.month, 20, 8, 0, 0), EnumTipoMovimiento.GASTO, 1000),
                (datetime(month_start.year, month_start.month, 22, 9, 0, 0), EnumTipoMovimiento.GASTO, 2000),
                (datetime(month_start.year, month_start.month, 21, 10, 0, 0), EnumTipoMovimiento.GASTO, 3000),
                (datetime(month_start.year, month_start.month, 18, 11, 0, 0), EnumTipoMovimiento.INGRESO, 9000),
                (previous_month, EnumTipoMovimiento.GASTO, 7000),
            ]

            for index, (fecha, tipo_movimiento, monto) in enumerate(movimientos_seed, start=1):
                await crear_movimiento(
                    data=MovimientoCreate(
                        id_categoria=categoria.id_categoria,
                        id_cuenta=cuenta.id_cuenta,
                        tipo_movimiento=tipo_movimiento,
                        tipo_gasto=EnumTipoGasto.VARIABLE,
                        monto=monto,
                        descripcion=f"mov {index}",
                        created_at=fecha,
                    ),
                    db=db,
                    user=user,
                )

            movimientos = await obtener_movimiento(
                offset=0,
                limit=2,
                db=db,
                user=user,
            )

            assert movimientos.offset == 0
            assert movimientos.limit == 2
            assert movimientos.total_gasto_mensual == 6000
            assert len(movimientos.items) == 2
            assert [mov.created_at for mov in movimientos.items] == [
                datetime(month_start.year, month_start.month, 22, 9, 0, 0),
                datetime(month_start.year, month_start.month, 21, 10, 0, 0),
            ]

            movimientos_pagina_2 = await obtener_movimiento(
                offset=2,
                limit=2,
                db=db,
                user=user,
            )

            assert movimientos_pagina_2.total_gasto_mensual == 6000
            assert len(movimientos_pagina_2.items) == 2
            assert [mov.created_at for mov in movimientos_pagina_2.items] == [
                datetime(month_start.year, month_start.month, 20, 8, 0, 0),
                datetime(month_start.year, month_start.month, 18, 11, 0, 0),
            ]
        finally:
            await trans.rollback()


@pytest.mark.asyncio(loop_scope="session")
async def test_detalle_cuenta_orders_transacciones_by_newest_date():
    async with AsyncSessionLocal() as db:
        trans = await db.begin()
        try:
            seed = uuid4().hex[:8]

            auth = User(
                email=f"cta_{seed}@mail.com",
                hashed_password="x",
                is_active=True,
                is_superuser=False,
                is_verified=False,
            )
            db.add(auth)
            await db.flush()

            perfil = Usuario(
                auth_user_id=auth.id,
                username=f"cta_{seed}",
                nombre="Cuenta",
                apellido="Test",
                telefono=f"5672{seed[:6]}",
                email=auth.email,
            )
            db.add(perfil)
            await db.flush()

            banco = Banco(nombre_banco=f"Banco Cta {seed}")
            categoria = CategoriaFinanza(nombre=f"categoria_cta_{seed}")
            db.add_all([banco, categoria])
            await db.flush()

            producto = ProductoFinanciero(
                id_banco=banco.id_banco,
                nombre_producto=f"Cuenta Cta {seed}",
            )
            db.add(producto)
            await db.flush()

            user = SimpleNamespace(id=auth.id)

            cuenta = await crear_cuenta_usuario(
                data=CuentaUsuarioCreate(
                    id_producto_financiero=producto.id_producto_financiero,
                    nombre_cuenta=f"Cuenta Cta {seed}",
                ),
                db=db,
                user=user,
            )

            for fecha in [
                datetime(2026, 4, 19, 12, 0, 0),
                datetime(2026, 4, 21, 12, 0, 0),
                datetime(2026, 4, 20, 12, 0, 0),
            ]:
                await crear_movimiento(
                    data=MovimientoCreate(
                        id_categoria=categoria.id_categoria,
                        id_cuenta=cuenta.id_cuenta,
                        tipo_movimiento=EnumTipoMovimiento.GASTO,
                        tipo_gasto=EnumTipoGasto.VARIABLE,
                        monto=5000,
                        created_at=fecha,
                    ),
                    db=db,
                    user=user,
                )

            detalle = await obtener_movimientos_cuenta(
                id_cuenta=cuenta.id_cuenta,
                db=db,
                user=user,
            )

            ordered = CuentaUsuarioMovimientosResponse.model_validate(detalle)
            assert [mov.created_at for mov in ordered.transacciones] == [
                datetime(2026, 4, 21, 12, 0, 0),
                datetime(2026, 4, 20, 12, 0, 0),
                datetime(2026, 4, 19, 12, 0, 0),
            ]
        finally:
            await trans.rollback()


@pytest.mark.asyncio(loop_scope="session")
async def test_finanzas_analitica_resumen_calcula_kpis_del_periodo():
    async with AsyncSessionLocal() as db:
        trans = await db.begin()
        try:
            seed = uuid4().hex[:8]

            auth = User(
                email=f"ana_res_{seed}@mail.com",
                hashed_password="x",
                is_active=True,
                is_superuser=False,
                is_verified=False,
            )
            db.add(auth)
            await db.flush()

            perfil = Usuario(
                auth_user_id=auth.id,
                username=f"ana_res_{seed}",
                nombre="Analitica",
                apellido="Resumen",
                telefono=f"5661{seed[:6]}",
                email=auth.email,
            )
            db.add(perfil)
            await db.flush()

            banco = Banco(nombre_banco=f"Banco Ana Res {seed}")
            categoria = CategoriaFinanza(nombre=f"categoria_ana_res_{seed}")
            db.add_all([banco, categoria])
            await db.flush()

            producto = ProductoFinanciero(
                id_banco=banco.id_banco,
                nombre_producto=f"Cuenta Ana Res {seed}",
            )
            db.add(producto)
            await db.flush()

            user = SimpleNamespace(id=auth.id)

            cuenta = await crear_cuenta_usuario(
                data=CuentaUsuarioCreate(
                    id_producto_financiero=producto.id_producto_financiero,
                    nombre_cuenta=f"Cuenta Ana Res {seed}",
                ),
                db=db,
                user=user,
            )

            chile_now = datetime.now(ZoneInfo("America/Santiago")).replace(tzinfo=None)
            current_year = chile_now.year
            current_month = chile_now.month
            current_day = min(chile_now.day, 10)

            if current_month == 1:
                previous_year = current_year - 1
                previous_month = 12
            else:
                previous_year = current_year
                previous_month = current_month - 1

            movimientos_seed = [
                (
                    datetime(current_year, current_month, current_day, 9, 0, 0),
                    EnumTipoMovimiento.GASTO,
                    EnumTipoGasto.FIJO,
                    3000,
                ),
                (
                    datetime(current_year, current_month, current_day, 10, 0, 0),
                    EnumTipoMovimiento.GASTO,
                    EnumTipoGasto.VARIABLE,
                    1000,
                ),
                (
                    datetime(current_year, current_month, current_day, 11, 0, 0),
                    EnumTipoMovimiento.INGRESO,
                    EnumTipoGasto.VARIABLE,
                    10000,
                ),
                (
                    datetime(previous_year, previous_month, 15, 12, 0, 0),
                    EnumTipoMovimiento.GASTO,
                    EnumTipoGasto.VARIABLE,
                    5000,
                ),
            ]

            for fecha, tipo_movimiento, tipo_gasto, monto in movimientos_seed:
                await crear_movimiento(
                    data=MovimientoCreate(
                        id_categoria=categoria.id_categoria,
                        id_cuenta=cuenta.id_cuenta,
                        tipo_movimiento=tipo_movimiento,
                        tipo_gasto=tipo_gasto,
                        monto=monto,
                        descripcion="seed analitica resumen",
                        created_at=fecha,
                    ),
                    db=db,
                    user=user,
                )

            resumen = await obtener_resumen_financiero(
                year=current_year,
                month=current_month,
                db=db,
                user=user,
            )

            expected_projection = (4000 / chile_now.day) * monthrange(current_year, current_month)[1]

            assert resumen.gasto_total == 4000
            assert resumen.ingreso_total == 10000
            assert resumen.balance_total == 6000
            assert resumen.gasto_fijo_total == 3000
            assert resumen.gasto_variable_total == 1000
            assert resumen.cantidad_movimientos == 3
            assert resumen.ticket_promedio_gasto == 2000
            assert resumen.gasto_mayor == 3000
            assert resumen.tasa_ahorro_pct == 60
            assert resumen.variacion_gasto_vs_mes_anterior == -1000
            assert resumen.variacion_gasto_vs_mes_anterior_pct == -20
            assert resumen.proyeccion_gasto_fin_mes == pytest.approx(expected_projection)
        finally:
            await trans.rollback()


@pytest.mark.asyncio(loop_scope="session")
async def test_finanzas_analitica_tendencia_completa_meses_sin_movimientos():
    async with AsyncSessionLocal() as db:
        trans = await db.begin()
        try:
            seed = uuid4().hex[:8]

            auth = User(
                email=f"ana_ten_{seed}@mail.com",
                hashed_password="x",
                is_active=True,
                is_superuser=False,
                is_verified=False,
            )
            db.add(auth)
            await db.flush()

            perfil = Usuario(
                auth_user_id=auth.id,
                username=f"ana_ten_{seed}",
                nombre="Analitica",
                apellido="Tendencia",
                telefono=f"5662{seed[:6]}",
                email=auth.email,
            )
            db.add(perfil)
            await db.flush()

            banco = Banco(nombre_banco=f"Banco Ana Ten {seed}")
            categoria = CategoriaFinanza(nombre=f"categoria_ana_ten_{seed}")
            db.add_all([banco, categoria])
            await db.flush()

            producto = ProductoFinanciero(
                id_banco=banco.id_banco,
                nombre_producto=f"Cuenta Ana Ten {seed}",
            )
            db.add(producto)
            await db.flush()

            user = SimpleNamespace(id=auth.id)

            cuenta = await crear_cuenta_usuario(
                data=CuentaUsuarioCreate(
                    id_producto_financiero=producto.id_producto_financiero,
                    nombre_cuenta=f"Cuenta Ana Ten {seed}",
                ),
                db=db,
                user=user,
            )

            chile_now = datetime.now(ZoneInfo("America/Santiago")).replace(tzinfo=None)
            current_year = chile_now.year
            current_month = chile_now.month

            if current_month == 1:
                two_months_ago_year = current_year - 1
                two_months_ago_month = 11
            elif current_month == 2:
                two_months_ago_year = current_year - 1
                two_months_ago_month = 12
            else:
                two_months_ago_year = current_year
                two_months_ago_month = current_month - 2

            seed_dates = [
                (
                    datetime(two_months_ago_year, two_months_ago_month, 8, 9, 0, 0),
                    EnumTipoMovimiento.GASTO,
                    7000,
                ),
                (
                    datetime(current_year, current_month, 9, 10, 0, 0),
                    EnumTipoMovimiento.INGRESO,
                    15000,
                ),
            ]

            for fecha, tipo_movimiento, monto in seed_dates:
                await crear_movimiento(
                    data=MovimientoCreate(
                        id_categoria=categoria.id_categoria,
                        id_cuenta=cuenta.id_cuenta,
                        tipo_movimiento=tipo_movimiento,
                        tipo_gasto=EnumTipoGasto.VARIABLE,
                        monto=monto,
                        descripcion="seed analitica tendencia",
                        created_at=fecha,
                    ),
                    db=db,
                    user=user,
                )

            tendencia = await obtener_tendencia_mensual(
                months=3,
                db=db,
                user=user,
            )

            assert tendencia.months == 3
            assert len(tendencia.items) == 3
            assert tendencia.items[0].label == f"{two_months_ago_year}-{two_months_ago_month:02d}"
            assert tendencia.items[0].gasto_total == 7000
            assert tendencia.items[0].ingreso_total == 0
            assert tendencia.items[1].gasto_total == 0
            assert tendencia.items[1].ingreso_total == 0
            assert tendencia.items[1].cantidad_movimientos == 0
            assert tendencia.items[2].label == f"{current_year}-{current_month:02d}"
            assert tendencia.items[2].gasto_total == 0
            assert tendencia.items[2].ingreso_total == 15000
            assert tendencia.items[2].balance_total == 15000
        finally:
            await trans.rollback()


@pytest.mark.asyncio(loop_scope="session")
async def test_finanzas_analitica_distribuciones_agrupa_por_categoria_y_cuenta():
    async with AsyncSessionLocal() as db:
        trans = await db.begin()
        try:
            seed = uuid4().hex[:8]

            auth = User(
                email=f"ana_dist_{seed}@mail.com",
                hashed_password="x",
                is_active=True,
                is_superuser=False,
                is_verified=False,
            )
            db.add(auth)
            await db.flush()

            perfil = Usuario(
                auth_user_id=auth.id,
                username=f"ana_dist_{seed}",
                nombre="Analitica",
                apellido="Distribucion",
                telefono=f"5663{seed[:6]}",
                email=auth.email,
            )
            db.add(perfil)
            await db.flush()

            banco = Banco(nombre_banco=f"Banco Ana Dist {seed}")
            categoria_1 = CategoriaFinanza(nombre=f"categoria_1_ana_dist_{seed}")
            categoria_2 = CategoriaFinanza(nombre=f"categoria_2_ana_dist_{seed}")
            db.add_all([banco, categoria_1, categoria_2])
            await db.flush()

            producto = ProductoFinanciero(
                id_banco=banco.id_banco,
                nombre_producto=f"Cuenta Ana Dist {seed}",
            )
            db.add(producto)
            await db.flush()

            user = SimpleNamespace(id=auth.id)

            cuenta_1 = await crear_cuenta_usuario(
                data=CuentaUsuarioCreate(
                    id_producto_financiero=producto.id_producto_financiero,
                    nombre_cuenta=f"Cuenta 1 Ana Dist {seed}",
                ),
                db=db,
                user=user,
            )
            cuenta_2 = await crear_cuenta_usuario(
                data=CuentaUsuarioCreate(
                    id_producto_financiero=producto.id_producto_financiero,
                    nombre_cuenta=f"Cuenta 2 Ana Dist {seed}",
                ),
                db=db,
                user=user,
            )

            chile_now = datetime.now(ZoneInfo("America/Santiago")).replace(tzinfo=None)
            current_year = chile_now.year
            current_month = chile_now.month

            movimientos_seed = [
                (categoria_1.id_categoria, cuenta_1.id_cuenta, 5000),
                (categoria_1.id_categoria, cuenta_2.id_cuenta, 3000),
                (categoria_2.id_categoria, cuenta_2.id_cuenta, 2000),
            ]

            for index, (id_categoria, id_cuenta, monto) in enumerate(movimientos_seed, start=1):
                await crear_movimiento(
                    data=MovimientoCreate(
                        id_categoria=id_categoria,
                        id_cuenta=id_cuenta,
                        tipo_movimiento=EnumTipoMovimiento.GASTO,
                        tipo_gasto=EnumTipoGasto.VARIABLE,
                        monto=monto,
                        descripcion=f"seed analitica distribucion {index}",
                        created_at=datetime(current_year, current_month, 12, 8 + index, 0, 0),
                    ),
                    db=db,
                    user=user,
                )

            distribucion_categorias = await obtener_distribucion_categorias(
                year=current_year,
                month=current_month,
                tipo_movimiento=EnumTipoMovimiento.GASTO,
                db=db,
                user=user,
            )
            distribucion_cuentas = await obtener_distribucion_cuentas(
                year=current_year,
                month=current_month,
                tipo_movimiento=EnumTipoMovimiento.GASTO,
                db=db,
                user=user,
            )

            assert distribucion_categorias.total_periodo == 10000
            assert [item.total for item in distribucion_categorias.items] == [8000, 2000]
            assert distribucion_categorias.items[0].porcentaje_del_total == 80
            assert distribucion_categorias.items[1].porcentaje_del_total == 20

            assert distribucion_cuentas.total_periodo == 10000
            assert [item.total for item in distribucion_cuentas.items] == [5000, 5000]
            assert [item.cantidad_movimientos for item in distribucion_cuentas.items] == [1, 2]
            assert distribucion_cuentas.items[0].porcentaje_del_total == 50
            assert distribucion_cuentas.items[1].porcentaje_del_total == 50
        finally:
            await trans.rollback()
