from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.db_schemas import CATALOGO_SCHEMA, table_ref


class Marca(Base):
    __tablename__ = "marca"
    __table_args__ = {"schema": CATALOGO_SCHEMA}

    id_marca: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre_marca: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=text("now()"),
        default=datetime.now,
    )

    productos: Mapped[list["Producto"]] = relationship(back_populates="marca")


class CategoriaProducto(Base):
    __tablename__ = "categoria_producto"
    __table_args__ = {"schema": CATALOGO_SCHEMA}

    id_categoria: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre_categoria: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=text("now()"),
        default=datetime.now,
    )

    subcategorias: Mapped[list["SubcategoriaProducto"]] = relationship(back_populates="categoria")
    productos: Mapped[list["Producto"]] = relationship(back_populates="categoria_rel")


class SubcategoriaProducto(Base):
    __tablename__ = "subcategoria_producto"
    __table_args__ = (
        UniqueConstraint(
            "id_categoria",
            "nombre_subcategoria",
            name="uq_subcategoria_producto_categoria_nombre",
        ),
        {"schema": CATALOGO_SCHEMA},
    )

    id_subcategoria: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    id_categoria: Mapped[int] = mapped_column(
        ForeignKey(table_ref(CATALOGO_SCHEMA, "categoria_producto.id_categoria")),
        nullable=False,
    )
    nombre_subcategoria: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=text("now()"),
        default=datetime.now,
    )

    categoria: Mapped["CategoriaProducto"] = relationship(back_populates="subcategorias")
    productos: Mapped[list["Producto"]] = relationship(back_populates="subcategoria_rel")


class Producto(Base):
    __tablename__ = "producto"
    __table_args__ = {"schema": CATALOGO_SCHEMA}

    id_producto: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    id_marca: Mapped[int] = mapped_column(ForeignKey(table_ref(CATALOGO_SCHEMA, "marca.id_marca")), nullable=False)
    id_categoria: Mapped[int | None] = mapped_column(
        ForeignKey(table_ref(CATALOGO_SCHEMA, "categoria_producto.id_categoria"))
    )
    id_subcategoria: Mapped[int | None] = mapped_column(
        ForeignKey(table_ref(CATALOGO_SCHEMA, "subcategoria_producto.id_subcategoria"))
    )
    nombre_producto: Mapped[str] = mapped_column(String(160), nullable=False)
    codigo_barra: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    sabor: Mapped[str | None] = mapped_column(String(100))
    formato: Mapped[str | None] = mapped_column(String(100))
    contenido_neto: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    unidad_contenido: Mapped[str | None] = mapped_column(String(30))
    activo: Mapped[bool] = mapped_column(Boolean, server_default=text("true"), default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=text("now()"),
        default=datetime.now,
    )

    marca: Mapped["Marca"] = relationship(back_populates="productos")
    categoria_rel: Mapped["CategoriaProducto | None"] = relationship(back_populates="productos")
    subcategoria_rel: Mapped["SubcategoriaProducto | None"] = relationship(back_populates="productos")
    tablas_nutricionales: Mapped[list["TablaNutricional"]] = relationship(back_populates="producto")
    compras_detalle: Mapped[list["CompraDetalle"]] = relationship(back_populates="producto")
    consumos_detalle: Mapped[list["ConsumoDetalle"]] = relationship(back_populates="producto")

    @property
    def categoria(self) -> str | None:
        if not self.categoria_rel:
            return None
        return self.categoria_rel.nombre_categoria

    @property
    def subcategoria(self) -> str | None:
        if not self.subcategoria_rel:
            return None
        return self.subcategoria_rel.nombre_subcategoria
