"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GenerarDocumento({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [estado, setEstado] = useState<"listo" | "generando" | "error">("listo");
  const [error, setError] = useState<string | null>(null);

  async function generar() {
    setEstado("generando");
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/documento`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "No se pudo generar el documento.");
        setEstado("error");
        return;
      }
      router.push(`/documentos/${data.documentoId}`);
    } catch {
      // El fallo más probable aquí es el timeout de la función, no la red.
      setError(
        "La generación ha tardado demasiado. El documento puede haberse creado " +
          "igualmente: míralo en Documentos antes de volver a intentarlo.",
      );
      setEstado("error");
    }
  }

  return (
    <div>
      <button className="boton" onClick={generar} disabled={estado === "generando"}>
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