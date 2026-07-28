from fastapi_users import BaseUserManager
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, Usuario

from app.auth.dependencies import get_user_db
from app.auth.schemas import UsuarioAuthCreate
from app.db import get_db
from app.settings import SECRET


class UserManager(BaseUserManager[User, int]):
    def __init__(self, user_db, session: AsyncSession):
        super().__init__(user_db)
        self.session = session

    reset_password_token_secret = SECRET
    verification_token_secret = SECRET

    def parse_id(self, user_id: str) -> int:
        return int(user_id)

    async def create(
        self,
        user_create: UsuarioAuthCreate,
        safe: bool = False,
        request: Request | None = None,
    ) -> User:
        await self.validate_password(user_create.password, user_create)

        existing_user = await self.user_db.get_by_email(user_create.email)
        if existing_user is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="El correo ya se encuentra registrado.",
            )

        existing_profile = await self.session.scalar(
            select(Usuario).where(
                or_(
                    Usuario.username == user_create.username,
                    Usuario.telefono == user_create.telefono,
                )
            )
        )
        if existing_profile is not None:
            if existing_profile.username == user_create.username:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="El nombre de usuario ya se encuentra registrado.",
                )
            if existing_profile.telefono == user_create.telefono:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="El telefono ya se encuentra registrado.",
                )

        user_dict: dict[str, object] = {
            "email": user_create.email,
            "hashed_password": self.password_helper.hash(user_create.password),
        }
        if not safe:
            if hasattr(user_create, "is_active"):
                user_dict["is_active"] = user_create.is_active
            if hasattr(user_create, "is_superuser"):
                user_dict["is_superuser"] = user_create.is_superuser
            if hasattr(user_create, "is_verified"):
                user_dict["is_verified"] = user_create.is_verified

        try:
            user = User(**user_dict)
            self.session.add(user)
            await self.session.flush()

            perfil = Usuario(
                auth_user_id=user.id,
                username=user_create.username,
                nombre=user_create.nombre,
                apellido=user_create.apellido,
                telefono=user_create.telefono,
                email=user.email,
            )
            self.session.add(perfil)
            await self.session.flush()

        except IntegrityError as exc:
            await self.session.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No fue posible crear el usuario porque correo, username o telefono ya existen.",
            ) from exc

        await self.on_after_register(user, request)

        return user

    async def authenticate(
        self,
        credentials: OAuth2PasswordRequestForm,
    ) -> User | None:
        login_value = credentials.username.strip()

        user = await self.user_db.get_by_email(login_value)

        if user is None:
            user = await self.session.scalar(
                select(User)
                .join(Usuario, Usuario.auth_user_id == User.id)
                .where(Usuario.username == login_value)
            )

        if user is None:
            # Mitiga timing attacks cuando no existe usuario.
            self.password_helper.hash(credentials.password)
            return None

        verified, updated_password_hash = self.password_helper.verify_and_update(
            credentials.password,
            user.hashed_password,
        )
        if not verified:
            return None

        if updated_password_hash is not None:
            await self.user_db.update(user, {"hashed_password": updated_password_hash})

        return user


async def get_user_manager(
    user_db=Depends(get_user_db),
    session: AsyncSession = Depends(get_db),
):
    yield UserManager(user_db, session)
