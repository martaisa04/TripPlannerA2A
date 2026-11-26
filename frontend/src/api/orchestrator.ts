/**
 * Cliente del OrchestratorAgent.
 *
 * En producción llama al Lambda proxy (VITE_PROXY_URL) que firma SigV4
 * server-side — el frontend no necesita credenciales AWS.
 */

const PROXY_URL = import.meta.env.VITE_PROXY_URL as string;
const DEFAULT_USER_ID = import.meta.env.VITE_DEFAULT_USER_ID ?? 'default-user';

export async function invokeOrchestrator(
  prompt: string,
  actorId: string = DEFAULT_USER_ID,
): Promise<string> {
  if (!PROXY_URL) {
    throw new Error(
      'VITE_PROXY_URL no está configurada en .env.local. ' +
      'Debe apuntar al endpoint /invoke del API Gateway.',
    );
  }

  const body = JSON.stringify({ prompt, actor_id: actorId });

  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => `HTTP ${response.status}`);
    throw new Error(`Error del agente (${response.status}): ${errorText}`);
  }

  const data = await response.json() as { response?: string; error?: string } | string;

  if (typeof data === 'string') return data;
  if ((data as { error?: string }).error) throw new Error((data as { error: string }).error);
  return (data as { response?: string }).response ?? JSON.stringify(data);
}

/** Alias no-streaming para compatibilidad con AgentChat que usa invokeOrchestratorStream */
export async function* invokeOrchestratorStream(
  prompt: string,
  actorId: string = DEFAULT_USER_ID,
): AsyncGenerator<string> {
  const result = await invokeOrchestrator(prompt, actorId);
  if (result) yield result;
}
