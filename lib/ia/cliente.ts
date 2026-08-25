/**
 * Cliente único de la API de Anthropic. Conexión directa desde el servidor.
 *
 * ALR-03: la key nunca vive en el frontend. `server-only` hace que el build
 * falle si alguien importa esto desde un componente cliente, que es la única
 * garantía real — ocultarlo en la interfaz no protege nada.
 */
import "server-only";

const BASE = "https://api.anthropic.com/v1/messages";
const VERSION = "2023-06-01";

/** El documento nombra claude-sonnet-4-6; ese string ya no está vigente. */
export const MODELO = "claude-sonnet-5";

export class IaError extends Error {
  constructor(message: string, readonly status?: number, readonly body?: unknown) {
    super(message);
    this.name = "IaError";
  }
}

function apiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new IaError("Falta la variable de entorno ANTHROPIC_API_KEY");
  return key;
}

export type RespuestaIa = {
  texto: string;
  modelo: string;
  tokensEntrada: number;
  tokensSalida: number;
};

/**
 * Una sola llamada, sin herramientas ni conversación (7.1: "una sola llamada
 * de generación"). Devuelve el texto crudo; el parseo va aparte.
 */
export async function generar(args: {
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<RespuestaIa> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: {
      "x-api-key": apiKey(),
      "anthropic-version": VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODELO,
      max_tokens: args.maxTokens ?? 8000,
      system: args.system,
      messages: [{ role: "user", content: args.prompt }],
    }),
  });

  const texto = await res.text();
  let payload: {
    content?: { type: string; text?: string }[];
    model?: string;
    usage?: { input_tokens: number; output_tokens: number };
    error?: { message?: string };
  };

  try {
    payload = JSON.parse(texto);
  } catch {
    throw new IaError(`Respuesta no interpretable de la API`, res.status, texto.slice(0, 500));
  }

  if (!res.ok) {
    throw new IaError(
      payload.error?.message ?? `La API devolvió ${res.status}`,
      res.status,
      payload,
    );
  }

  // El contenido llega como bloques. Se juntan los de texto y se ignora el
  // resto: no pedimos herramientas, pero no conviene asumir la posición 0.
  const salida = (payload.content ?? [])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text!)
    .join("\n");

  if (!salida) throw new IaError("La API no devolvió texto", res.status, payload);

  return {
    texto: salida,
    modelo: payload.model ?? MODELO,
    tokensEntrada: payload.usage?.input_tokens ?? 0,
    tokensSalida: payload.usage?.output_tokens ?? 0,
  };
}