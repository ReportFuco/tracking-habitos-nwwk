from sqlalchemy import (
    Integer, 
    String, 
    Text, 
    text, 
    DateTime, 
    ForeignKey,
    Enum as SQLEnum,
    Boolean,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.db.base import Base
from app.models.db_schemas import FINANZAS_SCHEMA, USUARIOS_SCHEMA, table_ref
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
    __tablename__ = "categoria_finanza"
    __table_args__ = {"schema": FINANZAS_SCHEMA}

    id_categoria: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(100), unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, 
        server_default=text("now()"), 
        default=datetime.now
    )

    transacciones: Mapped[list["Movimiento"]] = relationship(back_populates="categoria")


class Movimiento(Base):
    __tablename__ = "movimiento"
    __table_args__ = {"schema": FINANZAS_SCHEMA}

    id_transaccion: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
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
    created_at: Mapped[datetime] = mapped_column(
        DateTime, 
        default=datetime.now, 
        server_default=text("now()")
    )

    categoria: Mapped["CategoriaFinanza"] = relationship(back_populates="transacciones")
    cuenta: Mapped["CuentaUsuario"] = relationship(back_populates="transacciones")
    vinculos_compra: Mapped[list["MovimientoCompra"]] = relationship(
        back_populates="movimiento",
        cascade="all, delete-orphan",
    )
