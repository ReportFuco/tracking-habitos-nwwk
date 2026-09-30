"""Errores de dominio de la capa de servicios.

Los servicios no conocen HTTP ni MCP: lanzan estos errores y cada capa de entrada los
traduce (404/409 en REST, error de herramienta en MCP).
"""


class ErrorDominio(Exception):
    def __init__(self, mensaje: str):
        super().__init__(mensaje)
        self.mensaje = mensaje


class NoEncontrado(ErrorDominio):
    pass


class Conflicto(ErrorDominio):
    pass


class SinPermiso(ErrorDominio):
    pass


class DatosInvalidos(ErrorDominio):
    pass
