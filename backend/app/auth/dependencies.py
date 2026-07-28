from fastapi_users_db_sqlalchemy import SQLAlchemyUserDatabase
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

from app.models.usuario_auth import User
from app.db import get_db


async def get_user_db(
    session: AsyncSession = Depends(get_db),
):
    yield SQLAlchemyUserDatabase(session, User)
