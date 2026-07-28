from sqlalchemy import (
    Integer,
    String,
    Text,
    DateTime,
    Float, 
    ForeignKey,
    text,
    Boolean,
    Enum as SQLEnum,
    SmallInteger,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.db.base import Base
from app.models.db_schemas import ENTRENAMIENTOS_SCHEMA, USUARIOS_SCHEMA, table_ref
import enum


class EnumEstadoEntrenamiento(enum.Enum):
    ACTIVO = "activo"
    CERRADO = "cerrado"


class EnumTipoEntrenamiento(enum.Enum):
    FUERZA = "fuerza"
    CARDIO = "cardio"


class EnumTipoAerobico(enum.Enum):
    BICICLETA = "bicicleta"
    CORRER = "correr"
    NATACION = "natacion"


class Gimnasio(Base):
    __tablename__= "gimnasio"
    __table_args__ = {"schema": ENTRENAMIENTOS_SCHEMA}

    id_gimnasio: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nombre_gimnasio: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    nombre_cadena: Mapped[str] = mapped_column(String, nullable=True)
    direccion: Mapped[str] = mapped_column(String, nullable=True, unique=True)
    comuna: Mapped[str] = mapped_column(String, nullable=True)
    latitud: Mapped[float] = mapped_column(Float, nullable=False)
    longitud: Mapped[float] = mapped_column(Float, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=text("now()"), default=datetime.now)

    entrenamientos_fuerza = relationship(
        "EntrenamientoFuerza",
        back_populates="gimnasio"
    )


class Entrenamiento(Base):
    __tablename__ = "entrenamiento"
    __table_args__ = {"schema": ENTRENAMIENTOS_SCHEMA}

    id_entrenamiento: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_usuario: Mapped[int] = mapped_column(ForeignKey(table_ref(USUARIOS_SCHEMA, "usuario.id_usuario")))
    tipo_entrenamiento: Mapped[str] = mapped_column(
        SQLEnum(
            EnumTipoEntrenamiento,
            name="tipo_entrenamiento",
            schema=ENTRENAMIENTOS_SCHEMA,
            create_type=True,
            values_callable=lambda x: [e.value for e in x]
        )
    )

    observacion: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, 
        default=datetime.now,
        server_default=text("now()")
        )

    usuario: Mapped["Usuario"] = relationship(back_populates="entrenamientos")
    aerobico = relationship("EntrenamientoAerobico", back_populates="entrenamiento", uselist=False)
    fuerza = relationship("EntrenamientoFuerza", back_populates="entrenamiento", uselist=False)


class EntrenamientoAerobico(Base):
    __tablename__ = "entrenamiento_aerobico"
    __table_args__ = {"schema": ENTRENAMIENTOS_SCHEMA}

    id_aerobico: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_entrenamiento: Mapped[int] = mapped_column(ForeignKey(table_ref(ENTRENAMIENTOS_SCHEMA, "entrenamiento.id_entrenamiento")), unique=True)
    tipo_aerobico: Mapped[EnumTipoAerobico] = mapped_column(
        SQLEnum(
            EnumTipoAerobico,
            name="tipo aerobico",
            schema=ENTRENAMIENTOS_SCHEMA,
            values_callable=lambda x: [e.value for e in x]
        )
    )
    distancia_km: Mapped[float] = mapped_column(Float)
    duracion_segundos: Mapped[int] = mapped_column(Integer)
    calorias: Mapped[float] = mapped_column(Float)

    entrenamiento = relationship("Entrenamiento", back_populates="aerobico")


class EntrenamientoFuerza(Base):
    __tablename__ = "entrenamiento_fuerza"
    __table_args__ = {"schema": ENTRENAMIENTOS_SCHEMA}

    id_entrenamiento_fuerza: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_entrenamiento: Mapped[int] = mapped_column(ForeignKey(table_ref(ENTRENAMIENTOS_SCHEMA, "entrenamiento.id_entrenamiento")), unique=True)
    id_gimnasio: Mapped[int] = mapped_column(ForeignKey(table_ref(ENTRENAMIENTOS_SCHEMA, "gimnasio.id_gimnasio")))
    estado: Mapped[EnumEstadoEntrenamiento] = mapped_column(
        SQLEnum(
            EnumEstadoEntrenamiento,
            name="estado_entrenamiento_fuerza",
            schema=ENTRENAMIENTOS_SCHEMA,
            values_callable=lambda x: [e.value for e in x]
        ),
        server_default="activo",
        default=EnumEstadoEntrenamiento.ACTIVO,
    )
    inicio_at: Mapped[datetime] = mapped_column(DateTime, server_default=text("now()"), default=datetime.now)
    fin_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True) 
    
    gimnasio = relationship("Gimnasio", back_populates="entrenamientos_fuerza")
    entrenamiento = relationship("Entrenamiento", back_populates="fuerza")
    series = relationship(
        "SerieFuerza",
        back_populates="entrenamiento_fuerza",
        cascade="all, delete-orphan"
    )


class SerieFuerza(Base):
    __tablename__="serie_fuerza"
    __table_args__ = {"schema": ENTRENAMIENTOS_SCHEMA}

    id_fuerza_detalle: Mapped[int] = mapped_column(Integer, autoincrement=True, primary_key=True)
    id_entrenamiento_fuerza: Mapped[int] = mapped_column(ForeignKey(table_ref(ENTRENAMIENTOS_SCHEMA, "entrenamiento_fuerza.id_entrenamiento_fuerza")))
    id_ejercicio: Mapped[int] = mapped_column(ForeignKey(table_ref(ENTRENAMIENTOS_SCHEMA, "ejercicios.id_ejercicio")))
    es_calentamiento: Mapped[bool] = mapped_column(Boolean)
    cantidad_peso: Mapped[float] = mapped_column(Float, nullable=False)
    repeticiones: Mapped[int] = mapped_column(Integer, nullable=False)

    entrenamiento_fuerza = relationship(
        "EntrenamientoFuerza",
        back_populates="series"
    )
    ejercicio = relationship("Ejercicios")


class Musculo(Base):
    __tablename__ = "musculo"
    __table_args__ = {"schema": ENTRENAMIENTOS_SCHEMA}

    id_musculo: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    codigo: Mapped[str] = mapped_column(String(40), nullable=False, unique=True)
    nombre: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=text("now()"), default=datetime.now)

    subcategorias = relationship(
        "SubcategoriaMusculo",
        back_populates="musculo",
        cascade="all, delete-orphan",
    )


class SubcategoriaMusculo(Base):
    __tablename__ = "subcategoria_musculo"
    __table_args__ = (
        UniqueConstraint("id_musculo", "codigo", name="uq_subcategoria_musculo_musculo_codigo"),
        UniqueConstraint("id_musculo", "nombre", name="uq_subcategoria_musculo_musculo_nombre"),
        {"schema": ENTRENAMIENTOS_SCHEMA},
    )

    id_subcategoria_musculo: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    id_musculo: Mapped[int] = mapped_column(
        SmallInteger,
        ForeignKey(table_ref(ENTRENAMIENTOS_SCHEMA, "musculo.id_musculo")),
        nullable=False,
    )
    codigo: Mapped[str] = mapped_column(String(60), nullable=False)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=text("now()"), default=datetime.now)

    musculo = relationship("Musculo", back_populates="subcategorias")
    ejercicios = relationship("Ejercicios", back_populates="subcategoria_musculo")


class Ejercicios(Base):
    __tablename__ = "ejercicios"
    __table_args__ = {"schema": ENTRENAMIENTOS_SCHEMA}

    id_ejercicio: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(100))
    id_subcategoria_musculo: Mapped[int] = mapped_column(
        SmallInteger,
        ForeignKey(table_ref(ENTRENAMIENTOS_SCHEMA, "subcategoria_musculo.id_subcategoria_musculo")),
        nullable=False,
    )
    url_video:Mapped[str] = mapped_column(String, nullable=True)

    subcategoria_musculo = relationship("SubcategoriaMusculo", back_populates="ejercicios")
