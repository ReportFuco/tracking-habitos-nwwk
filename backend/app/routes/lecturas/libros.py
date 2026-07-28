from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from sqlalchemy import select
from app.models import lecturas, usuario


router = APIRouter(prefix="/libros", tags=["Lecturas · Libros"])

