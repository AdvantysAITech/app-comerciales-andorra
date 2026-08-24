import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import {
  transcribirAudio,
  TranscripcionError,
  FORMATOS_AUDIO,
  MODELO_TRANSCRIPCION,
} from "@/lib/ia/gemini";

export const runtime = "nodejs";

// Un minuto de audio son unos 1.900 tokens para Gemini; diez minutos se
// transcriben de sobra dentro de este margen.
export const maxDuration = 60;

/**
 * Tope de tamaño del audio.
 *
 * Vercel corta los cuerpos de petición en 4,5 MB, así que este límite no es
 * una preferencia: por encima, la petición ni siquiera llega a la función y el
 * comercial ve un error opaco. A 32 kbps son unos veinte minutos de grabación.
 */
const MAXIMO_BYTES = 4_000_000;

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // La transcripción cuesta dinero. Sin sesión no se transcribe nada.
  if (!user) return NextResponse.json({ error: "Sesión caducada" }, { status: 401 });

  let formulario: FormData;
  try {
    formulario = await request.formData();
  } catch {
    return NextResponse.json({ error: "No se pudo leer el audio enviado." }, { status: 400 });
  }

  const audio = formulario.get("audio");
  if (!(audio instanceof File)) {
    return NextResponse.json({ error: "Falta el audio." }, { status: 400 });
  }

  if (audio.size === 0) {
    return NextResponse.json({ error: "La grabación llegó vacía." }, { status: 400 });
  }

  if (audio.size > MAXIMO_BYTES) {
    return NextResponse.json(
      {
        error:
          "La grabación es demasiado larga para enviarla de una vez. " +
          "Párala antes y haz varias más cortas: se van sumando en el campo.",
      },
      { status: 413 },
    );
  }

  // El navegador manda el mime con parámetros ("audio/webm;codecs=opus").
  // Gemini quiere el tipo a secas.
  const mimeType = (audio.type || "audio/webm").split(";")[0].trim();

  if (!FORMATOS_AUDIO.includes(mimeType)) {
    return NextResponse.json(
      { error: `Formato de audio no admitido (${mimeType}).` },
      { status: 415 },
    );
  }

  try {
    const base64 = Buffer.from(await audio.arrayBuffer()).toString("base64");
    const texto = await transcribirAudio({ base64, mimeType });

    return NextResponse.json({ texto, modelo: MODELO_TRANSCRIPCION });
  } catch (error) {
    const detalle =
      error instanceof TranscripcionError ? error.message : "Error desconocido";

    console.error("[transcribir] falló", { mimeType, bytes: audio.size, detalle });

    return NextResponse.json(
      { error: `No se pudo transcribir el audio. ${detalle}` },
      { status: 502 },
    );
  }
}