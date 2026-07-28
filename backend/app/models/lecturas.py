from sqlalchemy import (
    BigInteger,
    String,
    Text,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    DateTime,
    text
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base
from datetime import date, datetime
from app.models.db_schemas import LECTURAS_SCHEMA, USUARIOS_SCHEMA, table_ref
import enum


class EstadoLectura(enum.Enum):
    TERMINADO = "terminado"
    EN_PROCESO = "en_proceso"
    ABANDONADO = "abandonado"
    SIN_COMENZAR = "sin_comenzar"


class Libros(Base):
    __tablename__="libros"
    __table_args__ = {"schema": LECTURAS_SCHEMA}

    id_libro: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nombre_libro: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    nombre_autor: Mapped[str] = mapped_column(String, nullable=False)
    total_paginas: Mapped[str] = mapped_column(String)
    categoria: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, 
        default=datetime.now, 
        server_default=text("now()")
    )

    lecturas: Mapped[list["Lectura"]] = relationship(back_populates="libro")


class Lectura(Base):
    __tablename__ = "lectura"
    __table_args__ = {"schema": LECTURAS_SCHEMA}

    id_lectura: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    id_usuario: Mapped[int] = mapped_column(ForeignKey(table_ref(USUARIOS_SCHEMA, "usuario.id_usuario")))
    id_libro: Mapped[int] = mapped_column(ForeignKey(table_ref(LECTURAS_SCHEMA, "libros.id_libro")), nullable=False)
    fecha_inicio: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, server_default=text("now()")) 
    fecha_fin: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    estado: Mapped[EstadoLectura] = mapped_column(
        SQLEnum(
            EstadoLectura,
            name="estado_lectura",
            schema=LECTURAS_SCHEMA,
            create_type=True,
            values_callable=lambda enum_cls: [
                e.value for e in enum_cls
            ],
        ),
        nullable=False,
        default=EstadoLectura.SIN_COMENZAR,
        server_default=EstadoLectura.SIN_COMENZAR.value,
    )

    usuario: Mapped["Usuario"] = relationship(back_populates="lecturas")
    registros: Mapped[list["RegistroLectura"]] = relationship(back_populates="lectura")
    libro: Mapped[Libros] = relationship(back_populates="lecturas")


class RegistroLectura(Base):
    __tablename__ = "registro_lectura"
    __table_args__ = {"schema": LECTURAS_SCHEMA}

    id_registro: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    id_lectura: Mapped[int] = mapped_column(ForeignKey(table_ref(LECTURAS_SCHEMA, "lectura.id_lectura")))
    pagina_inicio: Mapped[int] = mapped_column(Integer)
    pagina_final: Mapped[int] = mapped_column(Integer)
    observacion: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[date] = mapped_column(
        DateTime, 
        default=datetime.now, 
        server_default=text("now()"
        )
    )

    lectura: Mapped["Lectura"] = relationship(back_populates="registros")
