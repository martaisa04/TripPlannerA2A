/**
 * Cliente para invocar el OrchestratorAgent desplegado en Bedrock AgentCore.
 * Usa @smithy/signature-v4 + @aws-crypto/sha256-browser para firmar SigV4
 * correctamente en el navegador.
 */

import { SignatureV4 } from '@smithy/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-browser';

const ORCHESTRATOR_URL = import.meta.env.VITE_ORCHESTRATOR_URL;
const DEFAULT_USER_ID = import.meta.env.VITE_DEFAULT_USER_ID ?? 'default-user';

function getSigner() {
  const region = import.meta.env.VITE_AWS_REGION ?? 'us-east-2';
  const accessKeyId = import.meta.env.VITE_AWS_ACCESS_KEY_ID;
  const secretAccessKey = import.meta.env.VITE_AWS_SECRET_ACCESS_KEY;
  const sessionToken = import.meta.env.VITE_AWS_SESSION_TOKEN;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('Credenciales AWS no configuradas en .env.local');
  }

  return new SignatureV4({
    credentials: {
      accessKeyId,
      secretAccessKey,
      ...(sessionToken ? { sessionToken } : {}),
    },
    region,
    service: 'bedrock-agentcore',
    sha256: Sha256,
  });
}

export async function invokeOrchestrator(
  prompt: string,
  actorId: string = DEFAULT_USER_ID,
): Promise<string> {
  if (!ORCHESTRATOR_URL) {
    throw new Error('VITE_ORCHESTRATOR_URL no está configurada en .env.local');
  }

  const url = new URL(ORCHESTRATOR_URL);
  const body = JSON.stringify({ prompt, actor_id: actorId });

  const signer = getSigner();

  // Firmar la request
  const signed = await signer.sign({
    method: 'POST',
    hostname: url.hostname,
    path: url.pathname,
    protocol: 'https:',
    headers: {
      host: url.hostname,
      'content-type': 'application/json',
      'content-length': String(new TextEncoder().encode(body).length),
    },
    body,
  });

  const response = await fetch(ORCHESTRATOR_URL, {
    method: 'POST',
    headers: signed.headers as Record<string, string>,
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
