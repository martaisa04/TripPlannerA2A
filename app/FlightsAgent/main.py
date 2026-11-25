import os
import json
from contextlib import closing

from fastapi import FastAPI
from strands import Agent, tool
from strands.multiagent.a2a import A2AServer
from strands.tools.mcp.mcp_client import MCPClient
from mcp.client.streamable_http import streamablehttp_client


MCP_FLIGHTS_URL = "https://mcp.octotrip.app/flights/mcp"


@tool
def search_flights(origin: str, destination: str, date: str) -> list[dict]:
    """Busca ofertas de vuelos mediante OctoTrip MCP para el origen, destino y fecha indicados."""

    client = MCPClient(
        lambda: streamablehttp_client(
            MCP_FLIGHTS_URL,
            headers={"User-Agent": "Mozilla/5.0"},
        )
    )

    with client:
        result = client.call_tool_sync(
            tool_use_id="flight-search",
            name="search",
            arguments={
                "origin": origin,
                "destination": destination,
                "departure_date": date,
                "adults": 1,
                "currency": "COP",
                "locale": "es",
            },
        )

    if result.get("isError"):
        raise RuntimeError(f"OctoTrip MCP devolvió un error: {result}")

    structured = result.get("structuredContent", {})
    raw = structured.get("result")

    if raw:
        data = json.loads(raw)
    else:
        text_items = [
            item.get("text", "")
            for item in result.get("content", [])
            if item.get("text")
        ]
        if not text_items:
            raise RuntimeError("OctoTrip MCP no devolvió resultados.")
        data = json.loads(text_items[0])

    return data.get("results", [])


def create_agent(context_id: str) -> Agent:
    return Agent(
        name="Flights Agent",
        description="Busca vuelos entre ciudades para una fecha dada mediante OctoTrip MCP.",
        system_prompt="""Eres un asistente especializado en la b?squeda de vuelos.

Reglas:
1. Cuando el usuario solicite buscar vuelos, utiliza search_flights.
2. Utiliza exclusivamente los resultados devueltos por la herramienta.
3. No inventes ni modifiques aerol?neas, n?meros de vuelo, horarios, precios, escalas ni enlaces.
4. Conserva exactamente los valores y enlaces devueltos.
5. Si no hay resultados, informa que no se encontraron vuelos.
6. Si ocurre un error, informa que no fue posible consultar los vuelos.
7. Presenta los resultados en espa?ol y preferiblemente en una tabla.
8. Incluye enlaces de reserva solo si aparecen en los datos devueltos.
9. Si falta el origen, el destino o la fecha, solicita el dato faltante.
""",
        tools=[search_flights],
        callback_handler=None,
    )


# El servidor publica la agent card en /.well-known/agent-card.json
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
