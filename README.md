# TripPlannerA2A

Aplicación de planificación de viajes con arquitectura multiagente real desplegada en Amazon Bedrock AgentCore.

## Descripción

TripPlannerA2A permite buscar vuelos, consultar el clima y gestionar reservas de viaje mediante conversación natural con agentes de IA. Los agentes se comunican entre sí usando el protocolo A2A (Agent-to-Agent) y consultan fuentes de datos reales mediante MCP (Model Context Protocol).

---

## Arquitectura

Ver [ARCHITECTURE.md](./ARCHITECTURE.md) para el diagrama completo.

### Componentes principales

| Componente | Tipo | Estado |
|---|---|---|
| OrchestratorAgent | HTTP runtime — Bedrock AgentCore | ✅ Desplegado |
| FlightsAgent | A2A runtime — Bedrock AgentCore | ✅ Desplegado |
| WeatherAgent | A2A runtime — Bedrock AgentCore | ✅ Desplegado |
| ReservationsAgent | A2A runtime — Bedrock AgentCore | ✅ Desplegado |
| TripPlannerMemory | Bedrock AgentCore Memory | ✅ Desplegado |
| DynamoDB TripReservations | Base de datos de reservas | ✅ Desplegado |
| Lambdas CRUD reservas | 5 funciones (create/get/list/cancel/update) | ✅ Desplegado (update pendiente deploy) |
| API Gateway HTTP | Reservations API | ✅ Desplegado |
| Frontend React/Vite | Interfaz web | ⚠️ Local — pendiente hosting en S3 |

### Región y cuenta AWS

- **Región:** `us-east-2`
- **Cuenta:** `700002441872`
- **Stack CloudFormation:** `AgentCore-TripPlannerA2A-default`

---

## Estructura del proyecto

```
TripPlannerA2A/
├── agentcore/
│   ├── agentcore.json          # Configuración de runtimes, memoria y recursos
│   ├── aws-targets.json        # Cuenta y región de despliegue
│   ├── .env.local              # Credenciales locales (gitignored)
│   ├── .llm-context/           # Tipos TypeScript del schema
│   ├── cdk/                    # CDK stack (@aws/agentcore-cdk)
│   └── lambdas/
│       ├── proxy/invoke.py     # Lambda proxy SigV4 para el frontend
│       └── reservations/       # 5 Lambdas CRUD de reservas
│           ├── create.py
│           ├── get.py
│           ├── list_reservations.py
│           ├── cancel.py
│           └── update.py
├── app/
│   ├── FlightsAgent/main.py    # Agente A2A — MCP OctoTrip
│   ├── WeatherAgent/main.py    # Agente A2A — MCP Open-Meteo
│   ├── ReservationsAgent/main.py # Agente A2A — CRUD reservas
│   └── OrchestratorAgent/main.py # Agente HTTP — orquestador
├── frontend/                   # React + Vite
│   ├── src/
│   │   ├── api/
│   │   │   ├── orchestrator.ts # Cliente del proxy SigV4
│   │   │   └── reservations.ts # Cliente del API Gateway
│   │   └── components/
│   │       ├── AgentSidebar    # Panel de agentes
│   │       ├── AgentChat       # Chat flotante
│   │       ├── HeroSearch      # Buscador de vuelos
│   │       ├── FlightResults   # Resultados de vuelos
│   │       ├── AlternativeDestinations # Alternativas cuando no hay vuelos
│   │       └── ReservationsPanel # Gestión de reservas (crear/editar/cancelar)
│   └── .env.local              # Variables locales (gitignored)
├── ARCHITECTURE.md             # Diagrama de arquitectura
├── DEPLOY.md                   # Guía de despliegue
└── .gitignore
```

---

## Despliegue

Ver [DEPLOY.md](./DEPLOY.md) para instrucciones completas.

```bash
# Desde la raíz del proyecto
agentcore deploy
```

## Desarrollo local del frontend

```bash
cd frontend
cp .env.example .env.local
# Completar VITE_PROXY_URL y VITE_RESERVATIONS_API_URL con valores reales
npm install
npm run dev
# → http://localhost:3000
```

## Requisitos

- Node.js 20+
- Python 3.12+
- uv (`pip install uv`)
- AWS CLI v2 configurado
- agentcore CLI (`npm install -g @aws/agentcore`)
