import bcrypt
from typing import Annotated


def get_password_hash(password:Annotated[str, "Contraseña del usuario."])->str:
    """
    Genera un hash seguro para la contraseña proporcionada.
    """

    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)

    return hashed.decode("utf-8")