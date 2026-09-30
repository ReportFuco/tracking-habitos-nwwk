"""Normalización de texto para búsquedas sin tildes ni mayúsculas, en Python y en SQL."""
import unicodedata

from sqlalchemy import func


_ACCENTED_CHARS = "áéíóúàèìòùäëïöüâêîôûãõñÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÂÊÎÔÛÃÕÑ"
_PLAIN_CHARS = "aeiouaeiouaeiouaeiouaonAEIOUAEIOUAEIOUAEIOUAON"


def normalize_search_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.strip().lower())
    return "".join(char for char in normalized if not unicodedata.combining(char))


def normalize_sql_text(expression):
    return func.lower(func.translate(expression, _ACCENTED_CHARS, _PLAIN_CHARS))
