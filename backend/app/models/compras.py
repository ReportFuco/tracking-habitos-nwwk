from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.db_schemas import CATALOGO_SCHEMA, COMPRAS_SCHEMA, FINANZAS_SCHEMA, USUARIOS_SCHEMA, table_ref


class Cadena(Base):
    __tablename__ = "cadena"
    __table_args__ = {"schema": COMPRAS_SCHEMA}

    id_cadena: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre_cadena: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=text("now()"),
        default=datetime.now,
    )

    locales: Mapped[list["Local"]] = relationship(back_populates="cadena")


class Local(Base):
    __tablename__ = "local"
    __table_args__ = {"schema": COMPRAS_SCHEMA}

    id_local: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    id_cadena: Mapped[int | None] = mapped_column(ForeignKey(table_ref(COMPRAS_SCHEMA, "cadena.id_cadena")))
    nombre_local: Mapped[str] = mapped_column(String(120), nullable=False)
    latitud: Mapped[Decimal | None] = mapped_column(Numeric(10, 7))
    longitud: Mapped[Decimal | None] = mapped_column(Numeric(10, 7))
    direccion: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=text("now()"),
        default=datetime.now,
    )

    cadena: Mapped["Cadena | None"] = relationship(back_populates="locales")
    compras: Mapped[list["Compra"]] = relationship(back_populates="local")


class Compra(Base):
    __tablename__ = "compra"
    __table_args__ = {"schema": COMPRAS_SCHEMA}

    id_compra: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    id_local: Mapped[int] = mapped_column(ForeignKey(table_ref(COMPRAS_SCHEMA, "local.id_local")), nullable=False)
    id_usuario: Mapped[int] = mapped_column(ForeignKey(table_ref(USUARIOS_SCHEMA, "usuario.id_usuario")), nullable=False)
    fecha_compra: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=text("now()"),
        default=datetime.now,
    )

    local: Mapped["Local"] = relationship(back_populates="compras")
    usuario: Mapped["Usuario"] = relationship(back_populates="compras")
    detalles: Mapped[list["CompraDetalle"]] = relationship(back_populates="compra", cascade="all, delete-orphan")
    vinculos_movimiento: Mapped[list["MovimientoCompra"]] = relationship(
        back_populates="compra",
        cascade="all, delete-orphan",
    )


class CompraDetalle(Base):
    __tablename__ = "compra_detalle"
    __table_args__ = {"schema": COMPRAS_SCHEMA}

    id_detalle: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    id_compra: Mapped[int] = mapped_column(ForeignKey(table_ref(COMPRAS_SCHEMA, "compra.id_compra")), nullable=False)
    id_producto: Mapped[int] = mapped_column(ForeignKey(table_ref(CATALOGO_SCHEMA, "producto.id_producto")), nullable=False)
    cantidad_comprada: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    unidad_compra: Mapped[str] = mapped_column(String(30), nullable=False)
    precio_unitario: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    precio_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    cantidad_unidades: Mapped[int | None] = mapped_column(Integer)

    compra: Mapped["Compra"] = relationship(back_populates="detalles")
    producto: Mapped["Producto"] = relationship(back_populates="compras_detalle")


class MovimientoCompra(Base):
    __tablename__ = "movimiento_compra"
    __table_args__ = (
        UniqueConstraint("id_movimiento", "id_compra", name="uq_movimiento_compra_movimiento_compra"),
        {"schema": COMPRAS_SCHEMA},
    )

    id_movimiento_compra: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    id_movimiento: Mapped[int] = mapped_column(
        ForeignKey(table_ref(FINANZAS_SCHEMA, "movimiento.id_transaccion"), ondelete="CASCADE"),
        nullable=False,
    )
    id_compra: Mapped[int] = mapped_column(
        ForeignKey(table_ref(COMPRAS_SCHEMA, "compra.id_compra"), ondelete="CASCADE"),
        nullable=False,
    )
    monto_asociado: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=text("now()"),
        default=datetime.now,
    )

    movimiento: Mapped["Movimiento"] = relationship(back_populates="vinculos_compra")
    compra: Mapped["Compra"] = relationship(back_populates="vinculos_movimiento")
