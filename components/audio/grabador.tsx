"use client";

/**
 * Grabar y transcribir. Se cuelga de cualquier campo de texto largo.
 *
 * El texto transcrito se AÑADE a lo que ya haya en el campo, no lo sustituye:
 * el comercial puede grabar varios trozos, corregir a mano entre uno y otro, y
 * nada de lo escrito se pierde. El teclado sigue estando: el documento exige
 * que todo campo de audio admita escritura directa, para no dejar tirado a
 * quien esté en un sitio ruidoso o sin permiso de micrófono.
 */

import { useCallback, useEffect, useRef, useState } from "react";

/** Contenedores que aceptan a la vez el navegador y Gemini, por preferencia.
 *  Opus primero: a 32 kbps entran veinte minutos en el límite de subida. */
const FORMATOS = [
  "audio/webm;codecs=opus",
  "audio/ogg;codecs=opus",
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
];

/** Corte de seguridad. Sin esto, un micrófono abierto por olvido acaba en una
 *  grabación que no cabe en la petición y se pierde entera. */
const MAXIMO_SEGUNDOS = 15 * 60;

function formatoSoportado(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return FORMATOS.find((f) => MediaRecorder.isTypeSupported(f)) ?? null;
}

function reloj(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

type Estado = "listo" | "grabando" | "transcribiendo";

export default function GrabadorAudio({
  onTexto,
  desactivado = false,
}: {
  /** Recibe el texto transcrito. El padre decide dónde lo pega. */
  onTexto: (texto: string) => void;
  desactivado?: boolean;
}) {
  const [estado, setEstado] = useState<Estado>("listo");
  const [segundos, setSegundos] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const grabadora = useRef<MediaRecorder | null>(null);
  const trozos = useRef<Blob[]>([]);
  const intervalo = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Suelta el micrófono. Sin esto el indicador del navegador se queda
   *  encendido y en móvil el sistema mantiene el canal abierto. */
  const soltar = useCallback(() => {
    if (intervalo.current) {
      clearInterval(intervalo.current);
      intervalo.current = null;
    }
    grabadora.current?.stream.getTracks().forEach((t) => t.stop());
    grabadora.current = null;
  }, []);

  // Salir de la pantalla a media grabación no puede dejar el micrófono abierto.
  useEffect(() => soltar, [soltar]);

  async function transcribir(audio: Blob) {
    setEstado("transcribiendo");
    setError(null);

    try {
      const cuerpo = new FormData();
      // El nombre importa poco, pero un fichero sin extensión confunde a
      // algunos proxys que deciden por ella.
      cuerpo.append("audio", audio, "grabacion");

      const res = await fetch("/api/transcribir", { method: "POST", body: cuerpo });

      // Se lee como texto y se parsea a mano: una respuesta que no sea JSON
      // —un 413 del propio Vercel, por ejemplo— reventaría en res.json() y el
      // usuario recibiría un error que no dice nada.
      const crudo = await res.text();
      let data: { texto?: string; error?: string } | null = null;
      try {
        data = JSON.parse(crudo) as { texto?: string; error?: string };
      } catch {
        data = null;
      }

      if (!res.ok) {
        setError(
          data?.error ??
            (res.status === 413
              ? "La grabación pesa demasiado. Haz varias más cortas."
              : `El servidor respondió ${res.status}.`),
        );
        return;
      }

      if (!data?.texto) {
        setError("La transcripción vino vacía. Vuelve a intentarlo.");
        return;
      }

      onTexto(data.texto);
    } catch {
      setError("No se ha podido enviar el audio. Revisa la conexión.");
    } finally {
      setEstado("listo");
      setSegundos(0);
    }
  }

  async function empezar() {
    setError(null);

    const formato = formatoSoportado();
    if (!formato) {
      setError("Este navegador no permite grabar audio. Escribe el texto a mano.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      setError(
        "No hay acceso al micrófono. Da permiso en el navegador o escribe el texto a mano.",
      );
      return;
    }

    trozos.current = [];

    // 32 kbps mono es de sobra para voz y mantiene la grabación pequeña: es
    // lo que permite mandarla de una pieza sin trocear.
    const mr = new MediaRecorder(stream, { mimeType: formato, audioBitsPerSecond: 32000 });

    mr.ondataavailable = (e) => {
      if (e.data.size > 0) trozos.current.push(e.data);
    };

    mr.onstop = () => {
      soltar();
      const audio = new Blob(trozos.current, { type: formato });
      trozos.current = [];
      if (audio.size > 0) void transcribir(audio);
      else {
        setEstado("listo");
        setSegundos(0);
      }
    };

    grabadora.current = mr;
    mr.start();
    setEstado("grabando");
    setSegundos(0);

    intervalo.current = setInterval(() => {
      setSegundos((s) => {
        if (s + 1 >= MAXIMO_SEGUNDOS) {
          // Se para sola antes de pasarse del tamaño enviable.
          grabadora.current?.state === "recording" && grabadora.current.stop();
        }
        return s + 1;
      });
    }, 1000);
  }

  function parar() {
    if (grabadora.current?.state === "recording") grabadora.current.stop();
  }

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-3">
        {estado === "grabando" ? (
          <button type="button" className="boton" onClick={parar}>
            Parar y transcribir
          </button>
        ) : (
          <button
            type="button"
            className="boton-fantasma"
            onClick={empezar}
            disabled={desactivado || estado === "transcribiendo"}
          >
            {estado === "transcribiendo" ? "Transcribiendo…" : "Grabar y transcribir"}
          </button>
        )}

        {estado === "grabando" && (
          <span className="traza normal-case" aria-live="polite">
            <span
              aria-hidden
              className="mr-2 inline-block h-2 w-2 rounded-full bg-block align-middle"
            />
            Grabando · {reloj(segundos)}
          </span>
        )}

        {estado === "transcribiendo" && (
          <span className="traza normal-case" aria-live="polite">
            Enviando a transcribir. Tarda unos segundos.
          </span>
        )}
      </div>

      {error && <p className="error mt-2">{error}</p>}
    </div>
  );
}