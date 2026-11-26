"""
Lambda proxy con streaming — firma SigV4 y reenvía al OrchestratorAgent.

Usa awslambdaric streaming handler para transmitir la respuesta chunk a chunk
al frontend sin acumular toda la respuesta en memoria.

La Function URL tiene AuthType NONE — el endpoint es público pero solo tiene
permiso para invocar el OrchestratorAgent (superficie mínima).

Variables de entorno requeridas (inyectadas por CDK):
  ORCHESTRATOR_URL — URL de invocación del OrchestratorAgent
  AWS_REGION_NAME  — Región (us-east-2). No usar AWS_REGION (reservada por Lambda).
"""
import json
import os

import boto3
import botocore.auth
import botocore.awsrequest
from awslambdaric import bootstrap  # noqa: F401  — confirma que awslambdaric está disponible

ORCHESTRATOR_URL = os.environ["ORCHESTRATOR_URL"]
REGION = os.environ.get("AWS_REGION_NAME", "us-east-2")
SERVICE = "bedrock-agentcore"

CORS_HEADERS = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "OPTIONS,POST",
}


def _signed_headers(url: str, body: bytes) -> dict:
    """Firma SigV4 con las credenciales temporales del rol de ejecución."""
    session = boto3.Session()
    credentials = session.get_credentials().get_frozen_credentials()

    aws_request = botocore.awsrequest.AWSRequest(
        method="POST",
        url=url,
        data=body,
        headers={"Content-Type": "application/json"},
    )
    botocore.auth.SigV4Auth(credentials, SERVICE, REGION).add_auth(aws_request)
    return dict(aws_request.headers)


def _parse_event(event: dict) -> tuple[str, str]:
    """Extrae prompt y actor_id del evento de la Function URL."""
    raw_body = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        import base64
        raw_body = base64.b64decode(raw_body).decode("utf-8")

    payload = json.loads(raw_body)
    prompt = payload.get("prompt", "")
    actor_id = payload.get("actor_id", "default-user")
    return prompt, actor_id


# ---------------------------------------------------------------------------
# Handler estándar (no-streaming) — usado por las pruebas directas de Lambda
# y como fallback si awslambdaric streaming no está disponible.
# ---------------------------------------------------------------------------

def handler(event, context):
    """Handler estándar: acumula la respuesta y la devuelve completa."""
    import urllib.request
    import urllib.error

    http_method = (
        event.get("requestContext", {}).get("http", {}).get("method", "")
        or event.get("httpMethod", "")
    )
    if http_method == "OPTIONS":
        return {"statusCode": 200, "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "OPTIONS,POST",
        }, "body": ""}

    try:
        prompt, actor_id = _parse_event(event)
        if not isinstance(prompt, str) or not prompt.strip():
            return {
                "statusCode": 400,
                "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"error": "El campo 'prompt' es requerido"}),
            }

        body_bytes = json.dumps({"prompt": prompt, "actor_id": actor_id}).encode("utf-8")
        signed = _signed_headers(ORCHESTRATOR_URL, body_bytes)

        req = urllib.request.Request(ORCHESTRATOR_URL, data=body_bytes, headers=signed, method="POST")
        with urllib.request.urlopen(req, timeout=300) as resp:
            response_body = resp.read().decode("utf-8")

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": response_body,
        }

    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace") if exc.fp else str(exc)
        return {
            "statusCode": exc.code,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": f"Orchestrator respondió {exc.code}", "detail": detail}),
        }
    except Exception as exc:  # pylint: disable=broad-except
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": str(exc)}),
        }


# ---------------------------------------------------------------------------
# Handler de streaming — invocado cuando Lambda usa RESPONSE_STREAM.
# awslambdaric >= 3.0 expone el decorador @lambda_handler_decorator para
# wrapping, pero la forma más directa es usar el streaming nativo:
# el handler recibe un responseStream en lugar de devolver un dict.
# ---------------------------------------------------------------------------

try:
    from awslambdaric.lambda_context import LambdaContext  # noqa: F401
    import awslambdaric.bootstrap as _bootstrap

    # awslambdaric >= 3.0 con soporte streaming
    _STREAMING_AVAILABLE = hasattr(_bootstrap, "run")
except ImportError:
    _STREAMING_AVAILABLE = False


if _STREAMING_AVAILABLE:
    import urllib.request as _urllib_request
    import urllib.error as _urllib_error

    def streaming_handler(event, response_stream, context):  # type: ignore[misc]
        """
        Handler de streaming para Lambda Function URL con InvokeWithResponseStream.

        Escribe los chunks del OrchestratorAgent directamente en response_stream
        a medida que llegan, sin acumularlos.
        """
        import io

        http_method = (
            event.get("requestContext", {}).get("http", {}).get("method", "")
            or event.get("httpMethod", "")
        )

        # CORS preflight
        if http_method == "OPTIONS":
            response_stream.write(b"")
            response_stream.close()
            return

        try:
            prompt, actor_id = _parse_event(event)
            if not isinstance(prompt, str) or not prompt.strip():
                error_msg = json.dumps({"error": "El campo 'prompt' es requerido"})
                response_stream.write(f"data: {error_msg}\n\n".encode("utf-8"))
                response_stream.close()
                return

            body_bytes = json.dumps({"prompt": prompt, "actor_id": actor_id}).encode("utf-8")
            signed = _signed_headers(ORCHESTRATOR_URL, body_bytes)

            req = _urllib_request.Request(
                ORCHESTRATOR_URL,
                data=body_bytes,
                headers=signed,
                method="POST",
            )

            with _urllib_request.urlopen(req, timeout=300) as resp:
                # Leer en chunks de 512 bytes y escribir inmediatamente
                while True:
                    chunk = resp.read(512)
                    if not chunk:
                        break
                    # Formato Server-Sent Events
                    response_stream.write(b"data: " + chunk + b"\n\n")

            # Señal de fin
            response_stream.write(b"data: [DONE]\n\n")

        except _urllib_error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace") if exc.fp else str(exc)
            error_msg = json.dumps({"error": f"Orchestrator respondió {exc.code}", "detail": detail})
            response_stream.write(f"data: {error_msg}\n\n".encode("utf-8"))

        except Exception as exc:  # pylint: disable=broad-except
            error_msg = json.dumps({"error": str(exc)})
            response_stream.write(f"data: {error_msg}\n\n".encode("utf-8"))

        finally:
            response_stream.close()
