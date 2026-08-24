"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BotonValidar({ id }: { id: string }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function validar() {
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(`/api/documentos/${id}/validar`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "No se pudo validar.");
      } else {
        router.refresh();
      }
    } catch {
      setError("No hay conexión con el servidor.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <button className="boton" onClick={validar} disabled={enviando}>
        {enviando ? "Validando…" : "Validar y habilitar la entrega"}
      </button>
      <p className="traza mt-2 normal-case">
        A partir de aquí el comercial podrá descargar el PDF del cliente.
      </p>
      {error && <p className="error mt-2">{error}</p>}
    </div>
  );
}