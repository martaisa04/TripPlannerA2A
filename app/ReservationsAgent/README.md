# ReservationsAgent

Agente A2A especializado en la gestión de reservas de viaje del proyecto TripPlannerA2A.

## Responsabilidad

Gestiona el ciclo de vida completo de una reserva:
- **Crear** reservas a partir de vuelos encontrados por FlightsAgent.
- **Consultar** una reserva por su ID.
- **Listar** todas las reservas de un usuario.
- **Cancelar** reservas activas (con verificación de propiedad).

## Arquitectura

```
OrchestratorAgent
  └─► ask_reservations() [tool, A2A/SigV4]
        └─► ReservationsAgent
              ├─► create_reservation()   → POST  API Gateway → Lambda → DynamoDB
              ├─► get_reservation()      → GET   API Gateway → Lambda → DynamoDB
              ├─► list_reservations()    → GET   API Gateway → Lambda → DynamoDB
              └─► cancel_reservation()  → PATCH API Gateway → Lambda → DynamoDB
```

## Variables de entorno

| Variable              | Descripción                                      |
|-----------------------|--------------------------------------------------|
| `RESERVATIONS_API_URL`| URL base del HTTP API Gateway de reservas        |
| `AGENTCORE_RUNTIME_URL` | URL pública del runtime (inyectada por AgentCore)|

## Desarrollo local

```bash
cd app/ReservationsAgent
uv venv
uv pip install -e .
RESERVATIONS_API_URL=https://<api-id>.execute-api.us-east-2.amazonaws.com python main.py
```

## Despliegue

El agente se despliega automáticamente con `agentcore deploy`.
La URL del API Gateway se inyecta como `RESERVATIONS_API_URL` via `envVars` en `agentcore.json`.
