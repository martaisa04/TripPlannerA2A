"""
Lambda: GET /reservations/{reservationId}
Obtiene una reserva por ID. Verifica que pertenece al userId del token.
"""
import json
import os

import boto3
from _utils import safe_dumps

TABLE_NAME = os.environ["RESERVATIONS_TABLE"]
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)

HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "OPTIONS,GET",
}


def handler(event, _context):
    try:
        reservation_id = (event.get("pathParameters") or {}).get("reservationId")
        if not reservation_id:
            return {
                "statusCode": 400,
                "headers": HEADERS,
                "body": json.dumps({"error": "reservationId requerido"}),
            }

        # userId puede venir del query string para validar propiedad
        user_id = (event.get("queryStringParameters") or {}).get("userId")

        response = table.get_item(Key={"reservationId": reservation_id})
        item = response.get("Item")

        if not item:
            return {
                "statusCode": 404,
                "headers": HEADERS,
                "body": json.dumps({"error": f"Reserva {reservation_id} no encontrada"}),
            }

        if user_id and item.get("userId") != user_id:
            return {
                "statusCode": 403,
                "headers": HEADERS,
                "body": json.dumps({"error": "No tienes acceso a esta reserva"}),
            }

        return {
            "statusCode": 200,
            "headers": HEADERS,
            "body": safe_dumps({"reservation": item}),
        }

    except Exception as exc:  # pylint: disable=broad-except
        return {
            "statusCode": 500,
            "headers": HEADERS,
            "body": json.dumps({"error": str(exc)}),
        }
