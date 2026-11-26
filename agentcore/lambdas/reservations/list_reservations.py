"""
Lambda: GET /reservations?userId=xxx[&status=ACTIVE]
Lista todas las reservas de un usuario, con filtro opcional de estado.
Usa el GSI userId-index.
"""
import json
import os

import boto3
from boto3.dynamodb.conditions import Key, Attr
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
        params = event.get("queryStringParameters") or {}
        user_id = params.get("userId")
        status_filter = params.get("status")  # Ej: ACTIVE, CANCELLED

        if not user_id:
            return {
                "statusCode": 400,
                "headers": HEADERS,
                "body": json.dumps({"error": "userId requerido"}),
            }

        kwargs = {
            "IndexName": "userId-index",
            "KeyConditionExpression": Key("userId").eq(user_id),
        }

        if status_filter:
            kwargs["FilterExpression"] = Attr("status").eq(status_filter.upper())

        response = table.query(**kwargs)
        items = response.get("Items", [])

        # Ordenar por fecha de creación descendente
        items.sort(key=lambda x: x.get("createdAt", ""), reverse=True)

        return {
            "statusCode": 200,
            "headers": HEADERS,
            "body": safe_dumps({"reservations": items, "count": len(items)}),
        }

    except Exception as exc:  # pylint: disable=broad-except
        return {
            "statusCode": 500,
            "headers": HEADERS,
            "body": json.dumps({"error": str(exc)}),
        }
