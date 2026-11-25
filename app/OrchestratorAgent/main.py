import os
import boto3
import httpx
from a2a.client import ClientConfig
from mcp_proxy_for_aws.sigv4_helper import SigV4HTTPXAuth
from strands import Agent, tool
from strands.agent.a2a_agent import A2AAgent
from bedrock_agentcore.runtime import BedrockAgentCoreApp
from bedrock_agentcore.memory.integrations.strands.config import (
    AgentCoreMemoryConfig,
    RetrievalConfig,
)
from bedrock_agentcore.memory.integrations.strands.session_manager import (
    AgentCoreMemorySessionManager,
)

app = BedrockAgentCoreApp()

FLIGHTS_URL = os.environ["FLIGHTS_AGENT_URL"]
WEATHER_URL = os.environ["WEATHER_AGENT_URL"]
RESERVATIONS_URL = os.environ["RESERVATIONS_AGENT_URL"]
REGION = os.environ.get("AWS_REGION", "us-east-2")
MEMORY_ID = os.environ.get("TRIP_MEMORY_ID") or None


def create_remote_agent(endpoint: str) -> A2AAgent:
    """Crea un cliente A2A autenticado con AWS SigV4."""
    credentials = boto3.Session().get_credentials()

    auth = SigV4HTTPXAuth(
        credentials=credentials,
        service="bedrock-agentcore",
        region=REGION,
    )

    http_client = httpx.AsyncClient(auth=auth, timeout=300)
    client_config = ClientConfig(httpx_client=http_client)

    return A2AAgent(endpoint=endpoint, client_config=client_config)


@tool
def ask_flights(request: str) -> str:
    """Delega en el Flights Agent la búsqueda de vuelos."""
    remote = create_remote_agent(FLIGHTS_URL)
    return str(remote(request).message)


@tool
def ask_weather(request: str) -> str:
    """Delega en el Weather Agent. Incluye siempre ciudad y fecha en la solicitud."""
    remote = create_remote_agent(WEATHER_URL)
    return str(remote(request).message)


@tool
def ask_reservations(request: str) -> str:
    """
    Delega en el Reservations Agent todas las operaciones sobre reservas de viaje:
    crear, consultar, listar y cancelar reservas.

    Incluye siempre en la solicitud:
    - Para crear: datos del vuelo (origen, destino, fecha, aerolínea, precio) y userId.
    - Para consultar o cancelar: el ID de reserva (formato TRP-XXXXXXXX) y userId.
    - Para listar: el userId y opcionalmente el filtro de estado (ACTIVE o CANCELLED).
    - Para cancelar: transmite la confirmación explícita del usuario.
    """
    remote = create_remote_agent(RESERVATIONS_URL)
    return str(remote(request).message)


SYSTEM_PROMPT = """
Eres un planificador de viajes. Tienes tres agentes especializados a tu disposición:
- ask_flights: busca vuelos disponibles entre ciudades.
- ask_weather: consulta el pronóstico del clima para una ciudad y fecha.
- ask_reservations: gestiona reservas de viaje (crear, consultar, listar, cancelar).

REGLAS OBLIGATORIAS:
1. Utiliza las herramientas correspondientes para responder las consultas.
2. Cuando se soliciten vuelos y clima, consulta ambas herramientas.
3. Presenta unicamente datos respaldados por las respuestas recibidas.
4. No inventes vuelos, aerolineas, horarios, precios, temperaturas,
   probabilidades de lluvia ni otros datos.
5. No presentes datos simulados como si fueran reales.
6. Si una herramienta indica que sus datos son simulados, comunicalo.
7. Si falta informacion o una herramienta falla, indicalo claramente.
8. No afirmes que existe un pronostico para una fecha si la herramienta
   no proporciona informacion para ese dia.
9. Puedes utilizar las preferencias recordadas para ordenar opciones,
   pero no para modificar los resultados de las herramientas.
10. Responde en espanol y organiza la informacion por secciones.
11. El ano actual es 2026.

REGLAS DE RESERVAS:
12. Para crear una reserva, primero asegurate de tener: userId, origen, destino,
    fecha de salida, aerolinea y precio. Si falta alguno, solicitalos.
13. Antes de cancelar una reserva, SIEMPRE pide confirmacion explicita al usuario.
    No ejecutes la cancelacion sin confirmacion. Transmite esa confirmacion a ask_reservations.
14. Para operaciones de reserva, siempre incluye el userId del actor_id de la sesion
    o pidelo al usuario si no esta disponible.
15. Los IDs de reserva tienen el formato TRP-XXXXXXXX.
"""

def build_agent(session_id: str, actor_id: str) -> Agent:
    kwargs = {
        "name": "Trip Planner Orchestrator",
        "system_prompt": SYSTEM_PROMPT,
        "tools": [ask_flights, ask_weather, ask_reservations],
        "callback_handler": None,
    }
    if MEMORY_ID:
        config = AgentCoreMemoryConfig(
            memory_id=MEMORY_ID,
            session_id=session_id,
            actor_id=actor_id,
            retrieval_config={
                "/preferences/{actorId}/": RetrievalConfig(top_k=5, relevance_score=0.3),
                "/facts/{actorId}/": RetrievalConfig(top_k=5, relevance_score=0.3),
            },
        )
        kwargs["session_manager"] = AgentCoreMemorySessionManager(
            config, region_name=REGION
        )
    return Agent(**kwargs)


@app.entrypoint
async def invoke(payload, context):
    prompt = payload.get("prompt", "")

    if not isinstance(prompt, str):
        raise ValueError("prompt debe ser un string")

    session_id = getattr(context, "session_id", None) or "default-session"
    actor_id = payload.get("actor_id") or "default-user"

    agent = build_agent(session_id, actor_id)

    # Ejecutar el agente y esperar el resultado final,
    # sin transmitir los eventos internos del streaming.
    result = await agent.invoke_async(prompt)

    # Extraer únicamente el texto de la respuesta.
    content = result.message.get("content", [])

    response_text = "\n".join(
        item["text"]
        for item in content
        if isinstance(item, dict) and "text" in item
    )

    return response_text


if __name__ == "__main__":
    app.run()