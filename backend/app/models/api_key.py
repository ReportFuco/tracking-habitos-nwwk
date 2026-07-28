from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.db_schemas import AUTH_SCHEMA, table_ref


class ApiKey(Base):
    __tablename__ = "api_key"
    __table_args__ = {"schema": AUTH_SCHEMA}

    id_api_key: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    auth_user_id: Mapped[int] = mapped_column(
        ForeignKey(table_ref(AUTH_SCHEMA, "user.id"), ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    nombre: Mapped[str] = mapped_column(String(80), nullable=False)
    key_prefix: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    key_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"), default=True)
    usage_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"), default=0)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_used_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("now()"),
        default=datetime.now,
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="api_keys")
