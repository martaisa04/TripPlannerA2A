"""
Lambda: PATCH /reservations/{reservationId}/cancel
Cancela una reserva. Verifica que pertenece al userId y que está ACTIVE.
"""
import json
import os
from datetime import datetime, timezone

import boto3

TABLE_NAME = os.environ["RESERVATIONS_TABLE"]
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)

HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "OPTIONS,PATCH",
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

        body = json.loads(event.get("body") or "{}")
        user_id = body.get("userId")
        if not user_id:
            return {
                "statusCode": 400,
                "headers": HEADERS,
                "body": json.dumps({"error": "userId requerido en el cuerpo de la solicitud"}),
            }

        # Obtener la reserva actual
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
                "body": json.dumps({"error": f"La reserva {reservation_id} ya está cancelada"}),
            }

        now = datetime.now(timezone.utc).isoformat()

        # Actualizar estado a CANCELLED
        table.update_item(
            Key={"reservationId": reservation_id},
            UpdateExpression="SET #st = :status, updatedAt = :now, cancelledAt = :now",
            ExpressionAttributeNames={"#st": "status"},
            ExpressionAttributeValues={
                ":status": "CANCELLED",
                ":now": now,
            },
        )

        item["status"] = "CANCELLED"
        item["updatedAt"] = now
        item["cancelledAt"] = now

        return {
            "statusCode": 200,
            "headers": HEADERS,
            "body": json.dumps({
                "message": f"Reserva {reservation_id} cancelada exitosamente",
                "reservation": item,
            }),
        }

    except Exception as exc:  # pylint: disable=broad-except
        return {
            "statusCode": 500,
            "headers": HEADERS,
            "body": json.dumps({"error": str(exc)}),
        }
