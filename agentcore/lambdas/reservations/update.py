"""
Lambda: PATCH /reservations/{reservationId}
Actualiza campos editables de una reserva ACTIVE.

Campos permitidos: returnDate, passengers, notes, airline, flightNumber, bookingUrl.
No se permite cambiar: reservationId, userId, origin, destination, departureDate,
price, currency, status, createdAt.
"""
import json
import os
from datetime import datetime, timezone

import boto3
from _utils import safe_dumps

TABLE_NAME = os.environ["RESERVATIONS_TABLE"]
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)

HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "OPTIONS,PATCH",
}

# Campos que el usuario puede modificar
ALLOWED_FIELDS = {"returnDate", "passengers", "notes", "airline", "flightNumber", "bookingUrl"}


def handler(event, _context):
    try:
        reservation_id = (event.get("pathParameters") or {}).get("reservationId")
        if not reservation_id:
            return {
                "statusCode": 400,
                "headers": HEADERS,
                "body": json.dumps({"error": "reservationId requerido"}),
            }

        body = json.loads(event.get("body") or "{}")
        user_id = body.get("userId")
        if not user_id:
            return {
                "statusCode": 400,
                "headers": HEADERS,
                "body": json.dumps({"error": "userId requerido en el cuerpo de la solicitud"}),
            }

        # Verificar que la reserva existe y pertenece al usuario
        response = table.get_item(Key={"reservationId": reservation_id})
        item = response.get("Item")

        if not item:
            return {
                "statusCode": 404,
                "headers": HEADERS,
                "body": json.dumps({"error": f"Reserva {reservation_id} no encontrada"}),
            }

        if item.get("userId") != user_id:
            return {
                "statusCode": 403,
                "headers": HEADERS,
                "body": json.dumps({"error": "No tienes acceso a esta reserva"}),
            }

        if item.get("status") == "CANCELLED":
            return {
                "statusCode": 409,
                "headers": HEADERS,
                "body": json.dumps({"error": "No se puede modificar una reserva cancelada"}),
            }

        # Filtrar solo los campos permitidos que vienen en el body
        updates = {k: v for k, v in body.items() if k in ALLOWED_FIELDS}
        if not updates:
            return {
                "statusCode": 400,
                "headers": HEADERS,
                "body": json.dumps({
                    "error": "No hay campos válidos para actualizar",
                    "allowed": sorted(ALLOWED_FIELDS),
                }),
            }

        # Construir la expresión de actualización
        now = datetime.now(timezone.utc).isoformat()
        updates["updatedAt"] = now

        set_parts = []
        expr_names = {}
        expr_values = {}

        for idx, (field, value) in enumerate(updates.items()):
            placeholder_name = f"#f{idx}"
            placeholder_value = f":v{idx}"
            set_parts.append(f"{placeholder_name} = {placeholder_value}")
            expr_names[placeholder_name] = field
            expr_values[placeholder_value] = value

        table.update_item(
            Key={"reservationId": reservation_id},
            UpdateExpression="SET " + ", ".join(set_parts),
            ExpressionAttributeNames=expr_names,
            ExpressionAttributeValues=expr_values,
        )

        # Devolver el item actualizado
        item.update(updates)
        return {
            "statusCode": 200,
            "headers": HEADERS,
            "body": safe_dumps({
                "message": f"Reserva {reservation_id} actualizada exitosamente",
                "reservation": item,
            }),
        }

    except Exception as exc:  # pylint: disable=broad-except
        return {
            "statusCode": 500,
            "headers": HEADERS,
            "body": json.dumps({"error": str(exc)}),
        }
