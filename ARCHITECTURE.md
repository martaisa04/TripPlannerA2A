# Arquitectura — TripPlannerA2A

## Diagrama de flujo

```
┌─────────────────────────────────────────────────────────────────────┐
│  USUARIO (navegador)                                                │
│  Frontend React/Vite — http://localhost:3000  (local)              │
│  Pendiente: hosting en S3 + CloudFront                             │
└───────────┬─────────────────────────────────────────────┬──────────┘
            │ POST /invoke (HTTP, sin credenciales)        │ GET/POST/PATCH /reservations/*
            │                                             │ (HTTP, sin autenticación)
            ▼                                             ▼
┌───────────────────────┐              ┌──────────────────────────────┐
│  Lambda Proxy SigV4   │              │  API Gateway HTTP             │
│  TripPlannerA2A-      │              │  e65dfdudm0.execute-api.      │
│  orchestrator-proxy   │              │  us-east-2.amazonaws.com     │
│  (firma SigV4 con     │              │                              │
│   rol de ejecución)   │              │  Rutas:                      │
└───────────┬───────────┘              │  POST   /reservations        │
            │ POST /invocations/       │  GET    /reservations        │
            │ (HTTP, SigV4)            │  GET    /reservations/{id}   │
            ▼                         │  PATCH  /reservations/{id}   │
┌───────────────────────┐             │  PATCH  /reservations/{id}/cancel│
│  OrchestratorAgent    │             └──────┬────────────────────────┘
│  Bedrock AgentCore    │                    │ AWS_PROXY
│  Runtime HTTP         │             ┌──────▼────────────────────────┐
│  Python 3.12          │             │  AWS Lambda (Python 3.12)     │
│                       │             │  ├─ create.handler            │
│  Tools:               │             │  ├─ get.handler               │
│  ├─ ask_flights()     │             │  ├─ list_reservations.handler │
│  ├─ ask_weather()     │             │  ├─ cancel.handler            │
│  └─ ask_reservations()│             │  └─ update.handler            │
│                       │             └──────┬────────────────────────┘
│  Memoria:             │                    │ boto3
│  TripPlannerMemory    │             ┌──────▼────────────────────────┐
│  (USER_PREFERENCE +   │             │  DynamoDB                     │
│   SUMMARIZATION +     │             │  TripPlannerA2A-TripReservations│
│   SEMANTIC)           │             │  PK: reservationId            │
└──┬────────┬───────────┘             │  GSI: userId-index            │
   │        │          │              │  RemovalPolicy: RETAIN        │
   │ A2A    │ A2A      │ A2A          │  PITR: habilitado             │
   │ SigV4  │ SigV4    │ SigV4        └───────────────────────────────┘
   ▼        ▼          ▼
┌──────┐ ┌───────┐ ┌──────────────────────────────────────────┐
│Flights│ │Weather│ │  ReservationsAgent                       │
│Agent │ │Agent  │ │  Bedrock AgentCore Runtime A2A           │
│      │ │       │ │  Python 3.12                             │
│Tool: │ │Tools: │ │                                          │
│search│ │openm  │ │  Tools:                                  │
│_flig │ │eteo_  │ │  ├─ create_reservation()  → POST  API GW │
│hts() │ │search │ │  ├─ get_reservation()     → GET   API GW │
│      │ │_loca  │ │  ├─ list_reservations()   → GET   API GW │
│  │   │ │tions()│ │  ├─ cancel_reservation()  → PATCH API GW │
│  │   │ │openm  │ │  └─ update_reservation()  → PATCH API GW │
│  │   │ │eteo_  │ └──────────────────────────────────────────┘
│  │   │ │get_   │
│  │   │ │foreca │
│  │   │ │st()   │
└──┼───┘ └───┼───┘
   │         │
   ▼         ▼
┌──────────────────┐  ┌──────────────────────────┐
│ OctoTrip MCP     │  │ Open-Meteo MCP           │
│ mcp.octotrip.app │  │ open-meteo.caseyjhand.com│
│ /flights/mcp     │  │ /mcp                     │
│                  │  │                          │
│ Tool: search     │  │ Tools:                   │
│ (vuelos reales   │  │ openmeteo_search_        │
│  en tiempo real) │  │ locations()              │
└──────────────────┘  │ openmeteo_get_           │
                      │ forecast()               │
                      └──────────────────────────┘
```

---

## Comunicación entre componentes

| Origen | Destino | Protocolo | Autenticación |
|---|---|---|---|
| Frontend | Lambda Proxy | HTTP POST | Ninguna (público) |
| Lambda Proxy | OrchestratorAgent | HTTP + SigV4 | Rol IAM del Lambda |
| Frontend | API Gateway | HTTP | Ninguna (público) |
| API Gateway | Lambdas CRUD | AWS_PROXY | Rol IAM del API GW |
| Lambdas CRUD | DynamoDB | SDK boto3 | Rol IAM del Lambda |
| OrchestratorAgent | FlightsAgent | A2A + SigV4 | Rol IAM del runtime |
| OrchestratorAgent | WeatherAgent | A2A + SigV4 | Rol IAM del runtime |
| OrchestratorAgent | ReservationsAgent | A2A + SigV4 | Rol IAM del runtime |
| FlightsAgent | OctoTrip MCP | HTTPS | User-Agent header |
| WeatherAgent | Open-Meteo MCP | HTTPS | Ninguna |
| ReservationsAgent | API Gateway | HTTP | Ninguna (público) |
| OrchestratorAgent | TripPlannerMemory | SDK AgentCore | Rol IAM del runtime |

---

## Recursos AWS desplegados

| Recurso | ID / ARN |
|---|---|
| OrchestratorAgent runtime | `TripPlannerA2A_OrchestratorAgent-DZAPzV4CU4` |
| FlightsAgent runtime | `TripPlannerA2A_FlightsAgent-r74L5a3eom` |
| WeatherAgent runtime | `TripPlannerA2A_WeatherAgent-iEXKh9AfuB` |
| ReservationsAgent runtime | `TripPlannerA2A_ReservationsAgent-B4LW9YANsi` |
| TripPlannerMemory | `TripPlannerA2A_TripPlannerMemory-H6Sp3R8Duc` |
| DynamoDB table | `TripPlannerA2A-TripReservations` |
| API Gateway | `e65dfdudm0.execute-api.us-east-2.amazonaws.com` |
| CloudFormation stack | `AgentCore-TripPlannerA2A-default` |

---

## Memoria del agente

`TripPlannerMemory` tiene tres estrategias activas en el OrchestratorAgent:

| Estrategia | Namespace | Uso |
|---|---|---|
| `USER_PREFERENCE` | `/preferences/{actorId}/` | Preferencias de vuelo del usuario |
| `SUMMARIZATION` | `/summaries/{actorId}/{sessionId}/` | Resumen de cada sesión |
| `SEMANTIC` | `/facts/{actorId}/` | Hechos relevantes del viaje |

Expiración: 90 días. Se recupera automáticamente en cada sesión via `AgentCoreMemorySessionManager`.

---

## Estado por requisito del profesor

| Requisito | Estado | Notas |
|---|---|---|
| App web en AWS accesible por URL | ⚠️ Pendiente | Frontend local — falta S3 + CloudFront |
| Arquitectura multiagente real | ✅ | 4 agentes en Bedrock AgentCore |
| Agentes en Bedrock AgentCore | ✅ | Desplegados y operativos |
| HTTP streaming frontend → orquestador | ⚠️ Pendiente deploy | Código listo (SSE + Lambda Function URL) |
| Vuelos y clima sin respuestas fijas | ✅ | MCP reales OctoTrip y Open-Meteo |
| Presupuesto, fechas, viajeros, itinerario | ✅ | En buscador y system prompt del Orchestrator |
| Backend Lambda + API Gateway | ✅ | 5 Lambdas + API Gateway desplegados |
| Persistencia real en DynamoDB | ✅ | Tabla con PITR y RemovalPolicy RETAIN |
| Consulta, modificación y eliminación | ✅ código / ⚠️ deploy | update.py pendiente de deploy |
| Tools del agente para gestionar datos | ✅ código / ⚠️ deploy | update_reservation pendiente de deploy |
| Recuperación tras cerrar y reabrir | ✅ | DynamoDB persiste entre sesiones |
| Memoria para preferencias | ✅ | AgentCoreMemorySessionManager activo |
| Frontend en S3 | ❌ | Pendiente |
| Sin credenciales en frontend ni repositorio | ✅ | Proxy SigV4 server-side |
| Documentación y diagrama coherentes | ✅ | Este archivo |
