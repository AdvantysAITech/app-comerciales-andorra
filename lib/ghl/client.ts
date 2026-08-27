/**
 * Cliente único de GoHighLevel. Conexión directa, sin n8n.
 * El token es un Private Integration Token de la sub-cuenta y vive SOLO en servidor:
 * este módulo nunca debe importarse desde un componente cliente.
 */
import "server-only";

const BASE = "https://services.leadconnectorhq.com";

export class GhlError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "GhlError";
  }
}

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

export const locationId = () => env("GHL_LOCATION_ID");

type Opciones = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  version?: string;
  /** Segundos de caché para GET. 0 = sin caché. */
  revalidate?: number;
};

export async function ghl<T = unknown>(path: string, opciones: Opciones = {}): Promise<T> {
  const { method = "GET", body, query, version, revalidate = 0 } = opciones;

  const url = new URL(BASE + path);
  for (const [clave, valor] of Object.entries(query ?? {})) {
    if (valor !== undefined && valor !== "") url.searchParams.set(clave, String(valor));
  }

  const lanzar = () =>
    fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${env("GHL_TOKEN")}`,
        Version: version ?? process.env.GHL_API_VERSION ?? "2021-07-28",
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      ...(method === "GET"
        ? revalidate > 0
          ? { next: { revalidate } }
          : { cache: "no-store" as const }
        : {}),
    });

  let res = await lanzar();

  // GHL limita por ráfagas. Un reintento con espera corta cubre el caso normal.
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 1200));
    res = await lanzar();
  }

  const texto = await res.text();
  let payload: unknown;
  try {
    payload = texto ? JSON.parse(texto) : null;
  } catch {
    payload = texto;
  }

  if (!res.ok) {
    throw new GhlError(`GHL ${method} ${path} devolvió ${res.status}`, res.status, payload);
  }

  return payload as T;
}

/**
 * Subida multipart. Vía aparte de `ghl()` por dos motivos incompatibles con
 * ella:
 *
 *  - El cuerpo va como FormData, no como JSON. Y NO se pone `Content-Type` a
 *    mano: `fetch` lo genera con el `boundary` que toca. Si se fija a
 *    "multipart/form-data" sin boundary, el servidor no sabe partir el cuerpo
 *    y responde 400 sin explicar por qué.
 *  - El endpoint de subida a campos personalizados exige `Version: v3`,
 *    distinta de la 2021-07-28 que usa el resto de la API.
 */
export async function ghlSubida<T = unknown>(
  path: string,
  formData: FormData,
  opciones: { version?: string } = {},
): Promise<T> {
  const url = new URL(BASE + path);

  const lanzar = () =>
    fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env("GHL_TOKEN")}`,
        Version: opciones.version ?? "v3",
        Accept: "application/json",
      },
      body: formData,
    });

  let res = await lanzar();

  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 1200));
    res = await lanzar();
  }

  const texto = await res.text();
  let payload: unknown;
  try {
    payload = texto ? JSON.parse(texto) : null;
  } catch {
    payload = texto;
  }

  if (!res.ok) {
    throw new GhlError(`GHL POST ${path} devolvió ${res.status}`, res.status, payload);
  }

  return payload as T;
}