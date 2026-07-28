from pydantic import BaseModel


class CuentaUsuarioCreate(BaseModel):
    id_usuario: int
    id_producto_financiero: int
    nombre_cuenta: str
