from sqlalchemy import (
    Integer, 
    String, 
    Text, 
    Boolean, 
    DateTime, 
    text, 
    ForeignKey
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.db.base import Base
from app.models.db_schemas import HABITOS_SCHEMA, USUARIOS_SCHEMA, table_ref


class CategoriaHabito(Base):
    __tablename__ = "categoria_habito"
    __table_args__ = {"schema": HABITOS_SCHEMA}

    id_categoria: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(
        DateTime, 
        default=datetime.now,
        server_default=text("now()")    
    )

    habitos: Mapped[list["Habito"]] = relationship(back_populates="categoria")


class Habito(Base):
    __tablename__ = "habito"
    __table_args__ = {"schema": HABITOS_SCHEMA}

    id_habito: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_usuario: Mapped[int] = mapped_column(ForeignKey(table_ref(USUARIOS_SCHEMA, "usuario.id_usuario")))
    id_categoria: Mapped[int] = mapped_column(ForeignKey(table_ref(HABITOS_SCHEMA, "categoria_habito.id_categoria")))
    nombre: Mapped[str] = mapped_column(String(100))
    descripcion: Mapped[str] = mapped_column(Text)
    frecuencia: Mapped[str] = mapped_column(String(50))
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, 
        default=datetime.now,
        server_default=text("now()")
    )

    usuario: Mapped["Usuario"] = relationship(back_populates="habitos")
    categoria: Mapped["CategoriaHabito"] = relationship(back_populates="habitos")
    registros: Mapped[list["RegistroHabito"]] = relationship(back_populates="habito")


class RegistroHabito(Base):
    __tablename__ = "registro_habito"
    __table_args__ = {"schema": HABITOS_SCHEMA}

    id_registro: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_habito: Mapped[int] = mapped_column(ForeignKey(table_ref(HABITOS_SCHEMA, "habito.id_habito")))
    observacion: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, 
        server_default=text("now()"), 
        default=datetime.now
    )

    habito: Mapped["Habito"] = relationship(back_populates="registros")
