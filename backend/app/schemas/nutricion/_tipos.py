from decimal import Decimal
from typing import Annotated

from pydantic import PlainSerializer

# Pydantic v2 serializa Decimal como string ("12.50") y los schemas Zod del frontend
# esperan number: sin esto la respuesta no pasa parseApiResponse y la pantalla falla.
Numero = Annotated[Decimal, PlainSerializer(float, return_type=float, when_used="json")]
