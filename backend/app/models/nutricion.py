from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.db_schemas import CATALOGO_SCHEMA, NUTRICION_SCHEMA, USUARIOS_SCHEMA, table_ref


class Consumo(Base):
    __tablename__ = "consumo"
    __table_args__ = {"schema": NUTRICION_SCHEMA}

    id_consumo: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    id_usuario: Mapped[int] = mapped_column(ForeignKey(table_ref(USUARIOS_SCHEMA, "usuario.id_usuario")), nullable=False)
    fecha_consumo: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    tipo_comida: Mapped[str] = mapped_column(String(80), nullable=False)
    observacion: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=text("now()"),
        default=datetime.now,
    )

    usuario: Mapped["Usuario"] = relationship(back_populates="consumos")
    detalles: Mapped[list["ConsumoDetalle"]] = relationship(back_populates="consumo", cascade="all, delete-orphan")


class ConsumoDetalle(Base):
    __tablename__ = "consumo_detalle"
    __table_args__ = {"schema": NUTRICION_SCHEMA}

    id_consumo_detalle: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    id_consumo: Mapped[int] = mapped_column(ForeignKey(table_ref(NUTRICION_SCHEMA, "consumo.id_consumo")), nullable=False)
    id_producto: Mapped[int] = mapped_column(ForeignKey(table_ref(CATALOGO_SCHEMA, "producto.id_producto")), nullable=False)
    cantidad_consumida: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    unidad_consumida: Mapped[str] = mapped_column(String(30), nullable=False)

    consumo: Mapped["Consumo"] = relationship(back_populates="detalles")
    producto: Mapped["Producto"] = relationship(back_populates="consumos_detalle")


class TablaNutricional(Base):
    __tablename__ = "tabla_nutricional"
    __table_args__ = {"schema": NUTRICION_SCHEMA}

    id_tabla: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    id_producto: Mapped[int] = mapped_column(ForeignKey(table_ref(CATALOGO_SCHEMA, "producto.id_producto")), nullable=False)
    porcion_cantidad: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    porcion_unidad: Mapped[str | None] = mapped_column(String(30))
    calorias: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    proteinas: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    carbohidratos: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    grasas: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    azucares: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    sodio: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    fibra: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=text("now()"),
        default=datetime.now,
    )

    producto: Mapped["Producto"] = relationship(back_populates="tablas_nutricionales")


class MetaNutricional(Base):
    __tablename__ = "meta_nutricional"
    __table_args__ = {"schema": NUTRICION_SCHEMA}

    id_meta: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    id_usuario: Mapped[int] = mapped_column(ForeignKey(table_ref(USUARIOS_SCHEMA, "usuario.id_usuario")), nullable=False)
    fecha_inicio: Mapped[date] = mapped_column(Date, nullable=False)
    fecha_fin: Mapped[date | None] = mapped_column(Date)
    calorias_objetivo: Mapped[int | None] = mapped_column(Integer)
    proteinas_objetivo: Mapped[int | None] = mapped_column(Integer)
    carbohidratos_objetivo: Mapped[int | None] = mapped_column(Integer)
    grasas_objetivo: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=text("now()"),
        default=datetime.now,
    )

    usuario: Mapped["Usuario"] = relationship(back_populates="metas_nutricionales")


class PesoUsuario(Base):
    __tablename__ = "peso_usuario"
    __table_args__ = {"schema": NUTRICION_SCHEMA}

    id_peso: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    id_usuario: Mapped[int] = mapped_column(ForeignKey(table_ref(USUARIOS_SCHEMA, "usuario.id_usuario")), nullable=False)
    fecha_registro: Mapped[date] = mapped_column(Date, nullable=False)
    peso_kg: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=text("now()"),
        default=datetime.now,
    )

    usuario: Mapped["Usuario"] = relationship(back_populates="pesos")
