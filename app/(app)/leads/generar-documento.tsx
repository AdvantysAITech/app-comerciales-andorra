"use client";

/**
 * Generar (o abrir) la propuesta de un lead.
 *
 * Vive aquí, en `leads/`, y no en `leads/nuevo/`, porque lo usan dos
 * pantallas: la confirmación del alta y la ficha del listado. Tenerlo solo en
 * el alta dejaba sin salida a cualquier lead cuyo comercial cerrara la
 * pestaña: no había forma de generar su propuesta desde ningún otro sitio.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Respuesta = { documentoId?: string; error?: string };

export default function GenerarDocumento({
  leadId,
  documentoId = null,
  ancho = false,
}: {
  leadId: string;
  /** Si el lead ya tiene documento, se ofrece abrirlo en vez de regenerarlo. */
  documentoId?: string | null;
  /** Botón a todo el ancho: es lo que pide la ficha del listado. */
  ancho?: boolean;
}) {
  const router = useRouter();
  const [estado, setEstado] = useState<"listo" | "generando" | "error">("listo");
  const [error, setError] = useState<string | null>(null);

  if (documentoId) {
    return (
      <Link
        href={`/documentos/${documentoId}`}
        className={`boton-fantasma inline-block ${ancho ? "w-full text-center" : ""}`}
      >
        Ver propuesta
      </Link>
    );
  }

  async function generar() {
    setEstado("generando");
    setError(null);

    try {
      const res = await fetch(`/api/leads/${leadId}/documento`, { method: "POST" });

      // Se lee como texto y se parsea a mano. Con `res.json()` directo, una
      // respuesta que no sea JSON —un 405 vacío, una página de error de
      // Next— lanza una excepción que acaba en el `catch` de abajo, y el
      // usuario recibe un mensaje de timeout que no tiene nada que ver.
      const texto = await res.text();
      let data: Respuesta | null = null;
      try {
        data = JSON.parse(texto) as Respuesta;
      } catch {
        data = null;
      }

      if (!res.ok) {
        setError(
          data?.error ??
            `El servidor respondió ${res.status} sin un mensaje legible. Avisa a Alex con este número.`,
        );
        setEstado("error");
        return;
      }

      if (!data?.documentoId) {
        setError("El documento se generó pero la respuesta vino incompleta. Míralo en Documentos.");
        setEstado("error");
        return;
      }

      router.push(`/documentos/${data.documentoId}`);
    } catch {
      setError(
        "No se ha recibido respuesta del servidor. Puede ser un corte de red o que la " +
          "generación haya superado el minuto. El documento puede haberse creado igualmente: " +
          "míralo en Documentos antes de volver a intentarlo.",
      );
      setEstado("error");
    }
  }

  return (
    <div className={ancho ? "w-full" : ""}>
      <button
        className={`boton ${ancho ? "w-full" : ""}`}
        onClick={generar}
        disabled={estado === "generando"}
      >
        {estado === "generando" ? "Generando…" : "Generar propuesta"}
      </button>

      {estado === "generando" && (
        <p className="traza mt-2 normal-case">
          Tarda cerca de un minuto. No cierres esta pantalla.
        </p>
      )}

      {error && <p className="error mt-2">{error}</p>}
    </div>
  );
}