from sqlalchemy import (
    CheckConstraint,
    Integer, 
    String, 
    Text, 
    text, 
    DateTime, 
    ForeignKey,
    Enum as SQLEnum,
    Boolean,
    Index,
    Numeric,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from decimal import Decimal
from uuid import UUID
from app.db.base import Base
from app.models.db_schemas import CATALOGO_SCHEMA, FINANZAS_SCHEMA, USUARIOS_SCHEMA, table_ref
import enum


class EnumTarjeta(enum.Enum):
    DEBITO = "Débito"
    CREDITO = "Crédito"
    PREPAGO = "Prepago"
    VIRTUALES = "Virtuales"


class EnumTipoMovimiento(enum.Enum):
    GASTO = "gasto"
    INGRESO = "ingreso"


class EnumTipoGasto(enum.Enum):
    VARIABLE = "variable"
    FIJO = "fijo"


class Banco(Base):
    __tablename__ = "banco"
    __table_args__ = {"schema": FINANZAS_SCHEMA}

    id_banco: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nombre_banco: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(
        DateTime, 
        server_default=text("now()"), 
        default=datetime.now
    )
    productos_financieros: Mapped[list["ProductoFinanciero"]] = relationship(
        back_populates="banco"
    )


class ProductoFinanciero(Base):
    __tablename__ = "producto_financiero"
    __table_args__ = (
        UniqueConstraint("id_banco", "nombre_producto", name="uq_producto_financiero_banco_nombre"),
        {"schema": FINANZAS_SCHEMA},
    )

    id_producto_financiero: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_banco: Mapped[int] = mapped_column(ForeignKey(table_ref(FINANZAS_SCHEMA, "banco.id_banco")))
    nombre_producto: Mapped[str] = mapped_column(String(100))
    descripcion: Mapped[str | None] = mapped_column(Text, nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, server_default=text("true"), default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=text("now()"),
        default=datetime.now
    )

    banco: Mapped["Banco"] = relationship(back_populates="productos_financieros")
    cuentas: Mapped[list["CuentaUsuario"]] = relationship(back_populates="producto_financiero")


class CuentaUsuario(Base):
    __tablename__ = "cuenta_usuario"
    __table_args__ = {"schema": FINANZAS_SCHEMA}

    id_cuenta: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_usuario: Mapped[int] = mapped_column(ForeignKey(table_ref(USUARIOS_SCHEMA, "usuario.id_usuario")))
    id_producto_financiero: Mapped[int] = mapped_column(
        ForeignKey(table_ref(FINANZAS_SCHEMA, "producto_financiero.id_producto_financiero"))
    )
    nombre_cuenta: Mapped[str] = mapped_column(String(100))
    activo: Mapped[bool] = mapped_column(Boolean, server_default=text("true"), default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, 
        server_default=text("now()"), 
        default=datetime.now
    )

    producto_financiero: Mapped["ProductoFinanciero"] = relationship(back_populates="cuentas")
    usuario: Mapped["Usuario"] = relationship(back_populates="cuentas")
    transacciones: Mapped[list["Movimiento"]] = relationship(back_populates="cuenta")


class CategoriaFinanza(Base):
    """Categoría de movimientos.

    Sin ``id_usuario`` es una categoría por defecto: la ven todos y solo la administra un
    superusuario. Con ``id_usuario`` es propia de ese usuario y nadie más la ve. El nombre
    es único sin distinguir mayúsculas dentro de cada grupo; que una propia no repita el
    nombre de una por defecto lo valida el servicio, porque la base no puede cruzar los
    dos índices parciales.
    """

    __tablename__ = "categoria_finanza"
    __table_args__ = (
        Index(
            "uq_categoria_finanza_defecto_nombre",
            func.lower(text("nombre")),
            unique=True,
            postgresql_where=text("id_usuario IS NULL"),
        ),
        Index(
            "uq_categoria_finanza_usuario_nombre",
            "id_usuario",
            func.lower(text("nombre")),
            unique=True,
            postgresql_where=text("id_usuario IS NOT NULL"),
        ),
        {"schema": FINANZAS_SCHEMA},
    )

    id_categoria: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_usuario: Mapped[int | None] = mapped_column(
        ForeignKey(table_ref(USUARIOS_SCHEMA, "usuario.id_usuario"), ondelete="CASCADE"),
        nullable=True,
    )
    nombre: Mapped[str] = mapped_column(String(100))
    # Una categoría con movimientos no se borra: se archiva y deja de ofrecerse al registrar.
    activo: Mapped[bool] = mapped_column(Boolean, server_default=text("true"), default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, 
        server_default=text("now()"), 
        default=datetime.now
    )

    transacciones: Mapped[list["Movimiento"]] = relationship(back_populates="categoria")

    @property
    def es_propia(self) -> bool:
        return self.id_usuario is not None


class Movimiento(Base):
    __tablename__ = "movimiento"
    __table_args__ = (
        UniqueConstraint(
            "client_request_id",
            name="uq_movimiento_client_request_id",
        ),
        CheckConstraint(
            "(en_lugar_compra AND latitud IS NOT NULL AND longitud IS NOT NULL "
            "AND precision_ubicacion IS NOT NULL) OR "
            "(NOT en_lugar_compra AND latitud IS NULL AND longitud IS NULL "
            "AND precision_ubicacion IS NULL)",
            name="ck_movimiento_ubicacion_segun_lugar",
        ),
        CheckConstraint(
            "latitud IS NULL OR latitud BETWEEN -90 AND 90",
            name="ck_movimiento_latitud_rango",
        ),
        CheckConstraint(
            "longitud IS NULL OR longitud BETWEEN -180 AND 180",
            name="ck_movimiento_longitud_rango",
        ),
        CheckConstraint(
            "precision_ubicacion IS NULL OR precision_ubicacion >= 0",
            name="ck_movimiento_precision_no_negativa",
        ),
        CheckConstraint(
            "NOT en_lugar_compra OR tipo_movimiento = 'gasto'",
            name="ck_movimiento_ubicacion_solo_gasto",
        ),
        {"schema": FINANZAS_SCHEMA},
    )

    id_transaccion: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    client_request_id: Mapped[UUID | None] = mapped_column(Uuid, nullable=True)
    id_categoria: Mapped[int] = mapped_column(ForeignKey(table_ref(FINANZAS_SCHEMA, "categoria_finanza.id_categoria")))
    id_cuenta: Mapped[int] = mapped_column(ForeignKey(table_ref(FINANZAS_SCHEMA, "cuenta_usuario.id_cuenta")))
    tipo_movimiento: Mapped[EnumTipoMovimiento] = mapped_column(
        SQLEnum(
            EnumTipoMovimiento,
            name="tipo_movimiento",
            schema=FINANZAS_SCHEMA,
            create_type=True,
            values_callable=lambda enum_cls: [e.value for e in enum_cls]
        ),
        nullable=False
    )
    tipo_gasto: Mapped[EnumTipoGasto] = mapped_column(
        SQLEnum(
            EnumTipoGasto,
            name="tipo_gasto",
            schema=FINANZAS_SCHEMA,
            create_type=True,
            values_callable=lambda enum_cls: [e.value for e in enum_cls]
        )
    )
    monto: Mapped[int] = mapped_column(Integer, nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text, nullable=True)
    en_lugar_compra: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("false"),
    )
    latitud: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    longitud: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    precision_ubicacion: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, 
        default=datetime.now, 
        server_default=text("now()")
    )

    categoria: Mapped["CategoriaFinanza"] = relationship(back_populates="transacciones")
    cuenta: Mapped["CuentaUsuario"] = relationship(back_populates="transacciones")
    items: Mapped[list["MovimientoItem"]] = relationship(
        back_populates="movimiento",
        cascade="all, delete-orphan",
        # Al borrar el movimiento los borra la FK (ON DELETE CASCADE) sin cargarlos antes.
        passive_deletes=True,
        order_by="MovimientoItem.id_item",
    )


class MovimientoItem(Base):
    """Producto comprado dentro de un gasto.

    El detalle es opcional y puede ser parcial: un gasto de $12.000 puede tener solo dos
    productos detallados. Por eso ``precio_total`` también es opcional y no se exige que
    la suma cuadre con el monto (los descuentos al total del ticket la descuadran).
    """

    __tablename__ = "movimiento_item"
    __table_args__ = (
        CheckConstraint("cantidad > 0", name="ck_movimiento_item_cantidad_positiva"),
        CheckConstraint(
            "precio_total IS NULL OR precio_total >= 0",
            name="ck_movimiento_item_precio_no_negativo",
        ),
        {"schema": FINANZAS_SCHEMA},
    )

    id_item: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_movimiento: Mapped[int] = mapped_column(
        ForeignKey(table_ref(FINANZAS_SCHEMA, "movimiento.id_transaccion"), ondelete="CASCADE"),
        index=True,
    )
    id_producto: Mapped[int] = mapped_column(
        ForeignKey(table_ref(CATALOGO_SCHEMA, "producto.id_producto")),
        index=True,
    )
    cantidad: Mapped[Decimal] = mapped_column(
        Numeric(10, 3),
        nullable=False,
        default=Decimal("1"),
        server_default=text("1"),
    )
    precio_total: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now,
        server_default=text("now()"),
    )

    movimiento: Mapped["Movimiento"] = relationship(back_populates="items")
    producto: Mapped["Producto"] = relationship(back_populates="items_movimiento")
