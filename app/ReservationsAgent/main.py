"""
ReservationsAgent — Servidor A2A que gestiona reservas de viaje.

Expone cuatro herramientas que invocan el API Gateway de reservas:
  - create_reservation   → POST /reservations
  - get_reservation      → GET  /reservations/{id}
  - list_reservations    → GET  /reservations?userId=...
  - cancel_reservation   → PATCH /reservations/{id}/cancel

El OrchestratorAgent lo invoca via A2A con SigV4, igual que a FlightsAgent
y WeatherAgent.
"""
import json
import os

import httpx
from fastapi import FastAPI
from strands import Agent, tool
from strands.multiagent.a2a import A2AServer

# URL del API Gateway inyectada como env var por CDK / agentcore deploy
RESERVATIONS_API_URL = os.environ.get("RESERVATIONS_API_URL", "").rstrip("/")


# ---------------------------------------------------------------------------
# Herramientas (tools)
# ---------------------------------------------------------------------------

@tool
def create_reservation(
    user_id: str,
    origin: str,
    destination: str,
    departure_date: str,
    airline: str,
    price: str,
    currency: str = "COP",
    flight_number: str = "",
    return_date: str = "",
    passengers: int = 1,
    booking_url: str = "",
    notes: str = "",
) -> dict:
    """
    Crea una nueva reserva de vuelo.

    Args:
        user_id: Identificador del usuario (ej: 'user-123').
        origin: Ciudad o código IATA de origen (ej: 'BOG').
        destination: Ciudad o código IATA de destino (ej: 'MAD').
        departure_date: Fecha de salida en formato YYYY-MM-DD.
        airline: Nombre de la aerolínea.
        price: Precio total del vuelo como string (ej: '1500000').
        currency: Moneda del precio (default: 'COP').
        flight_number: Número de vuelo opcional.
        return_date: Fecha de regreso opcional (YYYY-MM-DD).
        passengers: Número de pasajeros (default: 1).
        booking_url: Enlace de reserva externo opcional.
        notes: Notas adicionales opcionales.

    Returns:
        Diccionario con la reserva creada, incluyendo reservationId.
    """
    if not RESERVATIONS_API_URL:
        return {"error": "RESERVATIONS_API_URL no configurada"}

    payload = {
        "userId": user_id,
        "origin": origin,
        "destination": destination,
        "departureDate": departure_date,
        "airline": airline,
        "price": price,
        "currency": currency,
        "passengers": passengers,
    }
    if flight_number:
        payload["flightNumber"] = flight_number
    if return_date:
        payload["returnDate"] = return_date
    if booking_url:
        payload["bookingUrl"] = booking_url
    if notes:
        payload["notes"] = notes

    try:
        response = httpx.post(
            f"{RESERVATIONS_API_URL}/reservations",
            json=payload,
            timeout=15,
        )
        return response.json()
    except Exception as exc:  # pylint: disable=broad-except
        return {"error": f"Error al crear la reserva: {exc}"}


@tool
def get_reservation(reservation_id: str, user_id: str = "") -> dict:
    """
    Obtiene los detalles de una reserva por su ID.

    Args:
        reservation_id: ID de la reserva (ej: 'TRP-A1B2C3D4').
        user_id: Opcional. Si se proporciona, verifica que la reserva pertenece al usuario.

    Returns:
        Diccionario con los datos de la reserva, o error si no existe.
    """
    if not RESERVATIONS_API_URL:
        return {"error": "RESERVATIONS_API_URL no configurada"}

    params = {}
    if user_id:
        params["userId"] = user_id

    try:
        response = httpx.get(
            f"{RESERVATIONS_API_URL}/reservations/{reservation_id}",
            params=params,
            timeout=15,
        )
        return response.json()
    except Exception as exc:  # pylint: disable=broad-except
        return {"error": f"Error al obtener la reserva: {exc}"}


@tool
def list_reservations(user_id: str, status: str = "") -> dict:
    """
    Lista todas las reservas de un usuario.

    Args:
        user_id: Identificador del usuario.
        status: Filtro opcional de estado: 'ACTIVE' o 'CANCELLED'.

    Returns:
        Diccionario con lista de reservas y conteo total.
    """
    if not RESERVATIONS_API_URL:
        return {"error": "RESERVATIONS_API_URL no configurada"}

    params: dict = {"userId": user_id}
    if status:
        params["status"] = status.upper()

    try:
        response = httpx.get(
            f"{RESERVATIONS_API_URL}/reservations",
            params=params,
            timeout=15,
        )
        return response.json()
    except Exception as exc:  # pylint: disable=broad-except
        return {"error": f"Error al listar reservas: {exc}"}


@tool
def cancel_reservation(reservation_id: str, user_id: str) -> dict:
    """
    Cancela una reserva activa.

    IMPORTANTE: Solicita confirmación explícita al usuario antes de llamar
    esta herramienta. La cancelación no se puede deshacer.

    Args:
        reservation_id: ID de la reserva a cancelar (ej: 'TRP-A1B2C3D4').
        user_id: Identificador del usuario propietario de la reserva.

    Returns:
        Diccionario con el resultado de la cancelación.
    """
    if not RESERVATIONS_API_URL:
        return {"error": "RESERVATIONS_API_URL no configurada"}

    try:
        response = httpx.patch(
            f"{RESERVATIONS_API_URL}/reservations/{reservation_id}/cancel",
            json={"userId": user_id},
            timeout=15,
        )
        return response.json()
    except Exception as exc:  # pylint: disable=broad-except
        return {"error": f"Error al cancelar la reserva: {exc}"}


@tool
def update_reservation(
    reservation_id: str,
    user_id: str,
    return_date: str = "",
    passengers: int = 0,
    notes: str = "",
    airline: str = "",
    flight_number: str = "",
    booking_url: str = "",
) -> dict:
    """
    Actualiza campos editables de una reserva activa existente.

    Conserva el mismo reservationId y solo modifica los campos proporcionados.
    No permite cambiar: origen, destino, fecha de salida, precio, moneda ni estado.

    Args:
        reservation_id: ID de la reserva (ej: 'TRP-A1B2C3D4').
        user_id: Identificador del usuario propietario de la reserva.
        return_date: Nueva fecha de regreso (YYYY-MM-DD). Opcional.
        passengers: Nuevo número de pasajeros. 0 significa sin cambio.
        notes: Nuevas notas o comentarios. Opcional.
        airline: Nombre de aerolínea corregido. Opcional.
        flight_number: Número de vuelo corregido. Opcional.
        booking_url: Nuevo enlace de reserva externo. Opcional.

    Returns:
        Diccionario con la reserva actualizada, o error si no existe o no pertenece al usuario.
    """
    if not RESERVATIONS_API_URL:
        return {"error": "RESERVATIONS_API_URL no configurada"}

    # Construir solo los campos que realmente cambian
    payload: dict = {"userId": user_id}
    if return_date:
        payload["returnDate"] = return_date
    if passengers > 0:
        payload["passengers"] = passengers
    if notes:
        payload["notes"] = notes
    if airline:
        payload["airline"] = airline
    if flight_number:
        payload["flightNumber"] = flight_number
    if booking_url:
        payload["bookingUrl"] = booking_url

    if len(payload) == 1:  # solo userId, nada que cambiar
        return {"error": "Debes indicar al menos un campo para actualizar"}

    try:
        response = httpx.patch(
            f"{RESERVATIONS_API_URL}/reservations/{reservation_id}",
            json=payload,
            timeout=15,
        )
        return response.json()
    except Exception as exc:  # pylint: disable=broad-except
        return {"error": f"Error al actualizar la reserva: {exc}"}


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """
Eres un agente especializado en la gestión de reservas de viaje.

HERRAMIENTAS DISPONIBLES:
- create_reservation: Crea una reserva nueva con los datos del vuelo seleccionado.
- get_reservation: Consulta los detalles de una reserva por su ID.
- list_reservations: Lista todas las reservas del usuario, con filtro opcional de estado.
- cancel_reservation: Cancela una reserva activa.
- update_reservation: Actualiza campos editables de una reserva activa existente.

REGLAS OBLIGATORIAS:
1. Utiliza SOLO los datos devueltos por las herramientas. No inventes reservas, IDs ni estados.
2. Antes de cancelar una reserva, SIEMPRE solicita confirmación explícita al usuario.
3. Para cancelar, verifica primero con get_reservation que la reserva existe y está ACTIVE.
4. Si la reserva ya está CANCELLED, informa al usuario sin llamar a cancel_reservation.
5. Si una operación falla, informa el error claramente sin reintentar automáticamente.
6. Responde siempre en español y presenta los datos de forma organizada.
7. Los IDs de reserva tienen el formato TRP-XXXXXXXX (ej: TRP-A1B2C3D4).
8. El año actual es 2026.

CAMPOS ACTUALIZABLES con update_reservation:
- return_date: fecha de regreso (YYYY-MM-DD)
- passengers: número de pasajeros
- notes: notas o comentarios
- airline: nombre de la aerolínea
- flight_number: número de vuelo
- booking_url: enlace de reserva externo

CAMPOS NO MODIFICABLES: reservationId, userId, origin, destination, departureDate, price, currency, status.

FLUJO DE CANCELACIÓN:
1. Recibir solicitud de cancelación con el ID.
2. Consultar la reserva con get_reservation para verificar existencia y estado.
3. Mostrar los detalles al usuario y pedir confirmación explícita.
4. Solo después de confirmación, ejecutar cancel_reservation.
5. Informar el resultado final.

FLUJO DE ACTUALIZACIÓN:
1. Recibir solicitud de modificación con el ID y los campos a cambiar.
2. Consultar con get_reservation para confirmar que existe y está ACTIVE.
3. Ejecutar update_reservation con solo los campos que el usuario quiere cambiar.
4. Confirmar el éxito únicamente si la herramienta devuelve la reserva actualizada.
5. Mostrar los datos actualizados al usuario.
"""


# ---------------------------------------------------------------------------
# Servidor A2A
# ---------------------------------------------------------------------------

def create_agent(context_id: str) -> Agent:
    return Agent(
        name="Reservations Agent",
        description=(
            "Gestiona reservas de viaje: crear, consultar, listar y cancelar. "
            "Integrado con DynamoDB via API Gateway."
        ),
        system_prompt=SYSTEM_PROMPT,
        tools=[create_reservation, get_reservation, list_reservations, cancel_reservation, update_reservation],
        callback_handler=None,
    )


a2a_server = A2AServer(
    agent_factory=create_agent,
    host="0.0.0.0",
    port=9000,
    http_url=os.environ.get("AGENTCORE_RUNTIME_URL"),
    serve_at_root=True,
)

app = FastAPI()


@app.get("/ping")
def ping():
    return {"status": "Healthy"}


app.mount("/", a2a_server.to_fastapi_app())


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=9000)
