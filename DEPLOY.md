# Guía de despliegue — TripPlannerA2A

Esta guía cubre el despliegue completo de la arquitectura extendida: agentes existentes
(FlightsAgent, WeatherAgent, OrchestratorAgent), la nueva capa de reservas
(ReservationsAgent + DynamoDB + Lambdas + API Gateway) y el frontend React/Vite.

---

## Arquitectura final

```
Frontend (React/Vite)
  └─► VITE_ORCHESTRATOR_URL (HTTP POST, SigV4)
        └─► OrchestratorAgent  [Bedrock AgentCore Runtime / HTTP]
              ├─► ask_flights()       → FlightsAgent  [A2A/SigV4] → OctoTrip MCP
              ├─► ask_weather()       → WeatherAgent  [A2A/SigV4] → Open-Meteo MCP
              └─► ask_reservations()  → ReservationsAgent [A2A/SigV4]
                    ├─► create_reservation()  → API Gateway → Lambda → DynamoDB
                    ├─► get_reservation()     → API Gateway → Lambda → DynamoDB
                    ├─► list_reservations()   → API Gateway → Lambda → DynamoDB
                    └─► cancel_reservation()  → API Gateway → Lambda → DynamoDB

Frontend (React/Vite)
  └─► /api/reservations/* (proxy Vite → VITE_RESERVATIONS_API_URL)
        └─► API Gateway → Lambda → DynamoDB  (acceso directo para módulo de reservas)
```

---

## Prerrequisitos

| Herramienta | Versión mínima | Verificar |
|---|---|---|
| AWS CLI | v2 | `aws --version` |
| Node.js | 18 | `node --version` |
| Python | 3.12 | `python --version` |
| uv | cualquiera | `uv --version` |
| agentcore CLI | instalado | `agentcore --version` |
| CDK CLI | v2 | `cdk --version` |

Credenciales AWS activas con permisos sobre: Bedrock AgentCore, CloudFormation,
Lambda, DynamoDB, API Gateway, IAM, ECR.

```bash
aws sts get-caller-identity   # debe devolver tu account/arn sin error
```

---

## Paso 1 — Desplegar la infraestructura AWS (DynamoDB + Lambdas + API Gateway)

El CDK stack de AgentCore ahora incluye la infraestructura de reservas.
El deploy se realiza con el CLI de AgentCore, que llama a CDK internamente.

```bash
cd agentcore
agentcore deploy
```

Al finalizar, el stack CloudFormation `AgentCore-TripPlannerA2A-default` creará:

- Tabla DynamoDB `TripPlannerA2A-TripReservations`
- 4 funciones Lambda (`reservation-create`, `reservation-get`, `reservation-list`, `reservation-cancel`)
- HTTP API Gateway con rutas CRUD en `/reservations`
- Runtime de Bedrock AgentCore para `ReservationsAgent`

Busca los outputs del stack:

```bash
aws cloudformation describe-stacks \
  --stack-name AgentCore-TripPlannerA2A-default \
  --query "Stacks[0].Outputs" \
  --output table
```

Anota los valores de:
- `ReservationsApiUrl` — URL base del API Gateway
- El ARN del runtime `ReservationsAgent` (visible en `agentcore status`)

---

## Paso 2 — Actualizar los PLACEHOLDERs en agentcore.json

Después del primer deploy, los runtimes `ReservationsAgent` y `OrchestratorAgent`
tienen valores `PLACEHOLDER_*` en sus `envVars`. Reemplázalos con los valores reales.

### 2a. URL del API Gateway → ReservationsAgent

En `agentcore/agentcore.json`, en el runtime `ReservationsAgent`:

```json
{
  "name": "RESERVATIONS_API_URL",
  "value": "https://<api-id>.execute-api.us-east-2.amazonaws.com"
}
```

### 2b. URL del ReservationsAgent → OrchestratorAgent

Obtén la URL de invocación del ReservationsAgent:

```bash
agentcore status
```

O desde AWS CLI:

```bash
aws cloudformation describe-stacks \
  --stack-name AgentCore-TripPlannerA2A-default \
  --query "Stacks[0].Outputs[?OutputKey=='ReservationsAgentInvocationUrl'].OutputValue" \
  --output text
```

Actualiza el runtime `OrchestratorAgent` en `agentcore/agentcore.json`:

```json
{
  "name": "RESERVATIONS_AGENT_URL",
  "value": "https://bedrock-agentcore.us-east-2.amazonaws.com/runtimes/arn%3Aaws%3Abedrock-agentcore%3Aus-east-2%3A700002441872%3Aruntime%2FTripPlannerA2A_ReservationsAgent-XXXXXXXXXX/invocations/"
}
```

### 2c. Re-deploy para aplicar los valores reales

```bash
agentcore deploy
```

---

## Paso 3 — Configurar el frontend

```bash
cd frontend
cp .env.example .env.local
```

Edita `frontend/.env.local`:

```env
# URL del OrchestratorAgent (de agentcore status o deployed-state.json)
VITE_ORCHESTRATOR_URL=https://bedrock-agentcore.us-east-2.amazonaws.com/runtimes/arn%3Aaws%3Abedrock-agentcore%3Aus-east-2%3A700002441872%3Aruntime%2FTripPlannerA2A_OrchestratorAgent-DZAPzV4CU4/invocations

# URL del API Gateway (output ReservationsApiUrl del stack)
VITE_RESERVATIONS_API_URL=https://<api-id>.execute-api.us-east-2.amazonaws.com

VITE_AWS_REGION=us-east-2
VITE_AWS_ACCESS_KEY_ID=<tu-access-key>
VITE_AWS_SECRET_ACCESS_KEY=<tu-secret-key>
VITE_AWS_SESSION_TOKEN=<tu-session-token>   # solo si usas credenciales temporales

VITE_DEFAULT_USER_ID=default-user
```

> **Nota de seguridad:** Las credenciales AWS en variables `VITE_*` quedan expuestas
> en el bundle del navegador. Esto es aceptable solo para desarrollo local o demos.
> En producción, usa un backend proxy que firme las peticiones server-side, o
> integra AWS Cognito para obtener credenciales temporales por usuario.

Levanta el servidor de desarrollo:

```bash
npm install
npm run dev
# → http://localhost:3000
```

---

## Paso 4 — Build de producción del frontend

```bash
cd frontend
npm run build
# genera frontend/dist/
```

Opciones de despliegue del frontend:

| Opción | Comando |
|---|---|
| **S3 + CloudFront** | `aws s3 sync dist/ s3://<bucket-name> --delete` |
| **Amplify Hosting** | Conectar repositorio en consola Amplify |
| **Vercel / Netlify** | `vercel --prod` / `netlify deploy --prod` |

Para S3 + CloudFront, configura la distribución con:
- Origin: el bucket S3
- Default root object: `index.html`
- Error page 403/404 → `index.html` (para React Router si se agrega)

---

## Paso 5 — Verificar el despliegue completo

### Verificar API Gateway de reservas

```bash
# Crear una reserva de prueba
curl -X POST https://<api-id>.execute-api.us-east-2.amazonaws.com/reservations \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "origin": "BOG",
    "destination": "MAD",
    "departureDate": "2026-12-15",
    "airline": "Iberia",
    "price": "2500000",
    "currency": "COP"
  }'
# → { "reservation": { "reservationId": "TRP-XXXXXXXX", "status": "ACTIVE", ... } }

# Listar reservas del usuario
curl "https://<api-id>.execute-api.us-east-2.amazonaws.com/reservations?userId=test-user"
```

### Verificar el OrchestratorAgent con reservas

```bash
agentcore invoke OrchestratorAgent \
  --payload '{"prompt": "Muéstrame mis reservas activas", "actor_id": "test-user"}'
```

### Verificar el flujo de cancelación

```bash
agentcore invoke OrchestratorAgent \
  --payload '{"prompt": "Quiero cancelar mi reserva TRP-XXXXXXXX", "actor_id": "test-user"}'
# El agente debe pedir confirmación antes de cancelar
```

---

## Variables de entorno — resumen completo

### agentcore/.env.local (desarrollo local de agentes)

| Variable | Descripción |
|---|---|
| `FLIGHTS_AGENT_URL` | URL invocación FlightsAgent en AgentCore |
| `WEATHER_AGENT_URL` | URL invocación WeatherAgent en AgentCore |
| `RESERVATIONS_AGENT_URL` | URL invocación ReservationsAgent en AgentCore |
| `TRIP_MEMORY_ID` | ID de la memoria TripPlannerMemory |
| `RESERVATIONS_API_URL` | URL base del API Gateway de reservas |

### frontend/.env.local

| Variable | Descripción |
|---|---|
| `VITE_ORCHESTRATOR_URL` | URL invocación OrchestratorAgent |
| `VITE_RESERVATIONS_API_URL` | URL base del API Gateway de reservas |
| `VITE_AWS_REGION` | Región AWS (`us-east-2`) |
| `VITE_AWS_ACCESS_KEY_ID` | Access key para firmar SigV4 |
| `VITE_AWS_SECRET_ACCESS_KEY` | Secret key para firmar SigV4 |
| `VITE_AWS_SESSION_TOKEN` | Session token (credenciales temporales) |
| `VITE_DEFAULT_USER_ID` | userId por defecto para el frontend |

---

## Estructura del proyecto tras la extensión

```
TripPlannerA2A/
├── agentcore/
│   ├── agentcore.json          # 4 runtimes: Flights, Weather, Reservations, Orchestrator
│   ├── .env.local              # Secrets locales (gitignored)
│   └── cdk/
│       └── lib/cdk-stack.ts    # AgentCoreApplication + DynamoDB + Lambdas + API GW
├── app/
│   ├── FlightsAgent/           # A2A — MCP OctoTrip (sin cambios)
│   ├── WeatherAgent/           # A2A — MCP Open-Meteo (sin cambios)
│   ├── ReservationsAgent/      # A2A — CRUD reservas via API Gateway (NUEVO)
│   └── OrchestratorAgent/      # HTTP — orquesta los 3 agentes (ask_reservations agregado)
├── frontend/                   # React + Vite (NUEVO)
│   ├── src/
│   │   ├── api/
│   │   │   ├── orchestrator.ts # Cliente SigV4 para OrchestratorAgent
│   │   │   └── reservations.ts # Cliente REST para API Gateway
│   │   └── components/
│   │       ├── ChatPanel       # Interfaz conversacional
│   │       └── ReservationsPanel # Módulo visual de reservas
│   └── .env.example
├── infra/
│   └── lambdas/reservations/   # 4 handlers Python para DynamoDB CRUD (NUEVO)
│       ├── create.py
│       ├── get.py
│       ├── list_reservations.py
│       └── cancel.py
└── DEPLOY.md                   # Esta guía
```

---

## Troubleshooting frecuente

### `KeyError: 'RESERVATIONS_AGENT_URL'` en OrchestratorAgent
Los PLACEHOLDERs aún no se reemplazaron. Sigue el Paso 2 y ejecuta `agentcore deploy` de nuevo.

### `{"success":false,"error":"The security token included in the request is invalid."}`
Las credenciales AWS expiraron. Renuévalas y actualiza `agentcore/.env.local` y `frontend/.env.local`.

### `VITE_ORCHESTRATOR_URL no está configurada`
El archivo `frontend/.env.local` no existe o le falta la variable. Cópialo de `.env.example`.

### Las reservas se crean pero el agente no las ve
Verifica que `RESERVATIONS_API_URL` en `agentcore.json` apunta al API Gateway correcto
y que `agentcore deploy` se ejecutó después de actualizar el valor.

### Error CORS al llamar al API Gateway desde el frontend
El API Gateway tiene CORS configurado con `allowOrigins: ['*']`. Si hay error CORS,
verifica que `VITE_RESERVATIONS_API_URL` en el frontend no tiene barra final (`/`).
