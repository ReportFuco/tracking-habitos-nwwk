"""Endpoints de la pantalla de consentimiento OAuth y de las apps conectadas.

Exigen la sesion del usuario (cookie o JWT), nunca una API key: aprobar una conexion
equivale a entregar una credencial nueva.
"""
from contextlib import contextmanager
from datetime import datetime
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.fastapi_users import current_user
from app.auth.scopes import Scope
from app.db import get_db
from app.mcp import oauth
from app.services.errores import NoEncontrado


router = APIRouter(prefix="/auth/oauth", tags=["Auth"])


class SolicitudResponse(BaseModel):
    cliente_nombre: str | None
    cliente_uri: str | None
    redirect_host: str = Field(description="Dominio al que vuelve el usuario tras aprobar.")
    scopes_disponibles: list[str]


class DecisionRequest(BaseModel):
    solicitud: str = Field(..., min_length=1, max_length=4000)


class AprobarRequest(DecisionRequest):
    scopes: list[Scope] = Field(..., min_length=1)


class RedireccionResponse(BaseModel):
    redirect_url: str


class ConexionResponse(BaseModel):
    id_autorizacion: int
    cliente_nombre: str | None
    scopes: list[str]
    created_at: datetime
    last_used_at: datetime | None


@contextmanager
def _errores_http():
    try:
        yield
    except oauth.SolicitudInvalida as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.mensaje) from exc
    except NoEncontrado as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.mensaje) from exc


@router.get("/solicitud", response_model=SolicitudResponse, summary="Detalle de una solicitud de conexion")
async def ver_solicitud(
    solicitud: str = Query(..., min_length=1, max_length=4000),
    user=Depends(current_user),
):
    with _errores_http():
        datos = await oauth.leer_solicitud(solicitud)
    return SolicitudResponse(
        cliente_nombre=datos.cliente.client_name,
        cliente_uri=str(datos.cliente.client_uri) if datos.cliente.client_uri else None,
        redirect_host=urlparse(datos.redirect_uri).netloc,
        scopes_disponibles=datos.scopes_disponibles,
    )


@router.post("/solicitud/aprobar", response_model=RedireccionResponse, summary="Aprobar una conexion")
async def aprobar_solicitud(
    data: AprobarRequest,
    user=Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    with _errores_http():
        url = await oauth.aprobar_solicitud(db, data.solicitud, user.id, list(data.scopes))
    return RedireccionResponse(redirect_url=url)


@router.post("/solicitud/rechazar", response_model=RedireccionResponse, summary="Rechazar una conexion")
async def rechazar_solicitud(data: DecisionRequest, user=Depends(current_user)):
    with _errores_http():
        url = await oauth.rechazar_solicitud(data.solicitud)
    return RedireccionResponse(redirect_url=url)


@router.get("/conexiones", response_model=list[ConexionResponse], summary="Apps conectadas por OAuth")
async def listar_conexiones(user=Depends(current_user), db: AsyncSession = Depends(get_db)):
    autorizaciones = await oauth.listar_autorizaciones(db, user.id)
    return [
        ConexionResponse(
            id_autorizacion=autorizacion.id_autorizacion,
            cliente_nombre=autorizacion.cliente.metadata_cliente.get("client_name"),
            scopes=autorizacion.scopes,
            created_at=autorizacion.created_at,
            last_used_at=autorizacion.last_used_at,
        )
        for autorizacion in autorizaciones
    ]


@router.delete(
    "/conexiones/{id_autorizacion}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revocar una app conectada",
)
async def revocar_conexion(id_autorizacion: int, user=Depends(current_user), db: AsyncSession = Depends(get_db)):
    with _errores_http():
        await oauth.revocar_autorizacion_de_usuario(db, user.id, id_autorizacion)
