"""
Utilidades compartidas para los handlers de reservas.
"""
import json
from decimal import Decimal


def convert_decimals(value):
    """Convierte recursivamente Decimal de DynamoDB a int o float."""
    if isinstance(value, Decimal):
        return int(value) if value % 1 == 0 else float(value)
    if isinstance(value, list):
        return [convert_decimals(item) for item in value]
    if isinstance(value, dict):
        return {key: convert_decimals(item) for key, item in value.items()}
    return value


def safe_dumps(data) -> str:
    """json.dumps seguro para datos provenientes de DynamoDB."""
    return json.dumps(convert_decimals(data))
