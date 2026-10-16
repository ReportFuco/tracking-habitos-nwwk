import unicodedata


def normalizar(valor: str | None) -> str:
    """Minusculas y sin tildes, para comparar nombres escritos de distintas formas."""
    sin_tildes = unicodedata.normalize("NFKD", valor or "").encode("ascii", "ignore").decode()
    return " ".join(sin_tildes.lower().split())
