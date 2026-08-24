/**
 * Cliente de la API de Gemini. Solo transcripción de audio.
 *
 * La generación de documentos usa Claude (lib/ia/cliente.ts); la transcripción
 * usa Gemini. Son dos proveedores para dos tareas distintas, tal como fija el
 * DERCAS, y por eso son dos ficheros y dos claves separadas.
 *
 * ALR-03: la key nunca vive en el frontend. `server-only` hace que el build
 * falle si alguien importa esto desde un componente cliente, que es la única
 * garantía real — ocultarlo en la interfaz no protege nada.
 */
import "server-only";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** Configurable por si el modelo por defecto se retira. */
export const MODELO_TRANSCRIPCION = process.env.GEMINI_MODELO ?? "gemini-3.6-flash";

/**
 * Formatos que aceptamos del navegador. Opus en WebM u Ogg según el
 * navegador; mp4/AAC en Safari. Se envía el contenedor real: reetiquetar un
 * WebM como Ogg no lo convierte, solo hace que falle más adelante.
 */
export const FORMATOS_AUDIO = [
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/aac",
  "audio/flac",
];

export class TranscripcionError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "TranscripcionError";
  }
}

const INSTRUCCIONES = `Eres un transcriptor. Devuelve ÚNICAMENTE la transcripción del audio.

Reglas:
- Transcribe en el idioma en que se habla (español, català o inglés). No traduzcas.
- Limpia muletillas, titubeos y repeticiones involuntarias, pero no resumas ni reescribas: el contenido y el orden de las ideas se respetan.
- Puntúa y separa en párrafos para que se lea bien.
- Si hay varias voces, no las etiquetes salvo que sea imprescindible para entender el sentido.
- Si no se oye nada inteligible, devuelve exactamente: [Audio sin contenido audible]
- No añadas encabezados, comentarios, comillas ni explicaciones. Solo el texto.`;

/**
 * Una llamada, un audio, un texto. El audio va en línea (inline_data) porque
 * la Files API solo compensa a partir de 20 MB, y aquí el techo lo pone antes
 * el límite de cuerpo de petición de Vercel.
 */
export async function transcribirAudio(args: {
  base64: string;
  mimeType: string;
}): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new TranscripcionError("Falta la variable de entorno GEMINI_API_KEY");

  const res = await fetch(`${BASE}/${MODELO_TRANSCRIPCION}:generateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": key,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: INSTRUCCIONES },
            { inline_data: { mime_type: args.mimeType, data: args.base64 } },
          ],
        },
      ],
      // Temperatura a cero: esto es transcribir, no redactar.
      generationConfig: { temperature: 0, maxOutputTokens: 8192 },
    }),
  });

  const crudo = await res.text();

  let payload: {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    promptFeedback?: { blockReason?: string };
    error?: { message?: string };
  };

  try {
    payload = JSON.parse(crudo);
  } catch {
    throw new TranscripcionError(
      `Respuesta no interpretable de Gemini (${res.status})`,
      res.status,
    );
  }

  if (!res.ok) {
    // El mensaje de Gemini se propaga tal cual: si rechaza el formato de
    // audio, es la única forma de enterarse sin adivinar.
    throw new TranscripcionError(
      payload.error?.message ?? `Gemini devolvió ${res.status}`,
      res.status,
    );
  }

  if (payload.promptFeedback?.blockReason) {
    throw new TranscripcionError(
      `Gemini bloqueó el audio: ${payload.promptFeedback.blockReason}`,
      422,
    );
  }

  const texto = (payload.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();

  if (!texto) throw new TranscripcionError("Gemini no devolvió transcripción", res.status);

  return texto;
}