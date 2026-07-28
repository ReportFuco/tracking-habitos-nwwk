from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import (
    String, 
    DateTime, 
    ForeignKey,
    text
)
from app.db.base import Base
from datetime import datetime
from app.models.habitos import Habito
from app.models.entrenamiento import Entrenamiento
from app.models.lecturas import Lectura
from app.models.finanzas import CuentaUsuario
from app.models.db_schemas import AUTH_SCHEMA, USUARIOS_SCHEMA, table_ref


class Usuario(Base):
    __tablename__= "usuario"
    __table_args__ = {"schema": USUARIOS_SCHEMA}

    id_usuario: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String(50), nullable=False)
    apellido: Mapped[str] = mapped_column(String(50), nullable=False)
    telefono: Mapped[str] = mapped_column(String(11), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    auth_user_id = mapped_column(
    ForeignKey(table_ref(AUTH_SCHEMA, "user.id")),
        unique=True,
        nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, 
        server_default=text("now()"), 
        default=datetime.now
    )

    # Relaciones
    user:Mapped["User"] = relationship("User", back_populates="usuario")
    habitos: Mapped[list["Habito"]] = relationship(back_populates="usuario")
    lecturas: Mapped[list["Lectura"]] = relationship(back_populates="usuario")
    cuentas: Mapped[list["CuentaUsuario"]] = relationship(back_populates="usuario")
    entrenamientos: Mapped[list["Entrenamiento"]] = relationship(back_populates="usuario")
    compras: Mapped[list["Compra"]] = relationship(back_populates="usuario")
    consumos: Mapped[list["Consumo"]] = relationship(back_populates="usuario")
    metas_nutricionales: Mapped[list["MetaNutricional"]] = relationship(back_populates="usuario")
    pesos: Mapped[list["PesoUsuario"]] = relationship(back_populates="usuario")
