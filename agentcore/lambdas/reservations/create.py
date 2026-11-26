"""
Lambda: POST /reservations
Crea una reserva nueva en DynamoDB.
"""
import json
import os
import uuid
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Key
from _utils import safe_dumps

TABLE_NAME = os.environ["RESERVATIONS_TABLE"]
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)

HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "OPTIONS,POST",
}


def handler(event, _context):
    try:
        body = json.loads(event.get("body") or "{}")

        required = ["userId", "origin", "destination", "departureDate", "airline", "price"]
        missing = [f for f in required if not body.get(f)]
        if missing:
            return {
                "statusCode": 400,
                "headers": HEADERS,
                "body": json.dumps({"error": f"Campos requeridos faltantes: {', '.join(missing)}"}),
            }

        reservation_id = "TRP-" + str(uuid.uuid4())[:8].upper()
        now = datetime.now(timezone.utc).isoformat()

        item = {
            "reservationId": reservation_id,
            "userId": body["userId"],
            "origin": body["origin"],
            "destination": body["destination"],
            "departureDate": body["departureDate"],
            "returnDate": body.get("returnDate"),
            "airline": body["airline"],
            "flightNumber": body.get("flightNumber", "N/A"),
            "price": str(body["price"]),
            "currency": body.get("currency", "COP"),
            "passengers": int(body.get("passengers", 1)),
            "status": "ACTIVE",
            "bookingUrl": body.get("bookingUrl"),
            "notes": body.get("notes"),
            "createdAt": now,
            "updatedAt": now,
        }

        table.put_item(Item=item)

        return {
            "statusCode": 201,
            "headers": HEADERS,
            "body": safe_dumps({"reservation": item}),
        }

    except Exception as exc:  # pylint: disable=broad-except
        return {
            "statusCode": 500,
            "headers": HEADERS,
            "body": json.dumps({"error": str(exc)}),
        }
