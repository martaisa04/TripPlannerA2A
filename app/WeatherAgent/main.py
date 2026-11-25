import os
from fastapi import FastAPI
from mcp.client.streamable_http import streamablehttp_client
from strands import Agent
from strands.multiagent.a2a import A2AServer
from strands.tools.mcp.mcp_client import MCPClient

WEATHER_MCP_URL = "https://open-meteo.caseyjhand.com/mcp"
ALLOWED_TOOLS = {"openmeteo_search_locations", "openmeteo_get_forecast"}

_mcp_client = None
_tools = None


def get_tools():
    """Conecta al MCP una sola vez y reutiliza las herramientas."""
    global _mcp_client, _tools
    if _tools is None:
        _mcp_client = MCPClient(lambda: streamablehttp_client(WEATHER_MCP_URL))
        _mcp_client.start()
        _tools = [t for t in _mcp_client.list_tools_sync()
                  if t.tool_name in ALLOWED_TOOLS]
    return _tools


SYSTEM_PROMPT = (
    "Eres un agente de clima. Para responder: 1) usa openmeteo_search_locations "
    "para obtener las coordenadas de la ciudad; 2) usa openmeteo_get_forecast con "
    "esas coordenadas para la fecha pedida. Responde con datos reales de las "
    "herramientas, sin inventar. Si la fecha está fuera del rango del pronóstico, "
    "dilo claramente. El año actual es 2026."
)


def create_agent(context_id: str) -> Agent:
    return Agent(
        name="Weather Agent",
        description="Consulta el pronóstico del clima para una ciudad y fecha dada.",
        system_prompt=SYSTEM_PROMPT,
        tools=get_tools(),
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