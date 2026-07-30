"""Genera un par VAPID para copiar al .env sin guardar la llave en el repo."""

import base64

from cryptography.hazmat.primitives import serialization
from py_vapid import Vapid


def base64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def main() -> None:
    vapid = Vapid()
    vapid.generate_keys()
    private_number = vapid.private_key.private_numbers().private_value
    private_raw = private_number.to_bytes(32, "big")
    public_raw = vapid.public_key.public_bytes(
        encoding=serialization.Encoding.X962,
        format=serialization.PublicFormat.UncompressedPoint,
    )

    print("Copia estas dos lineas en backend/.env y define VAPID_SUBJECT:")
    print(f"VAPID_PUBLIC_KEY={base64url(public_raw)}")
    print(f"VAPID_PRIVATE_KEY={base64url(private_raw)}")
    print("VAPID_SUBJECT=mailto:tu-correo@dominio.cl")


if __name__ == "__main__":
    main()
