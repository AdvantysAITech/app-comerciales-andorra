"use client";

/**
 * Botón de validar.  →  app/documentos/[id]/interno/boton-validar.tsx
 *
 * Dos arreglos respecto de la versión anterior:
 *
 *   - La URL. Apuntaba a `/api/documentos/:id/validar`, que no existe: la ruta
 *     está en `app/documentos/[id]/validar/`. Daba 404, el `res.json()`
 *     reventaba contra el HTML de error de Next y el `catch` pintaba «No hay
 *     conexión con el servidor», que mandaba a buscar el fallo donde no estaba.
 *   - El texto. Validar ya no «habilita la descarga» —el comercial puede
 *     descargar desde que se genera— sino que envía el documento al CRM.
 */

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
      const res = await fetch(`/documentos/${id}/validar`, { method: "POST" });

      // Si la respuesta no es JSON (404 de Next, error de proxy), `json()`
      // lanza. Se lee como texto y se decide, en vez de dejar que el catch
      // culpe a la conexión.
      const texto = await res.text();
      let datos: { error?: string; crm?: { error: string | null } } = {};
      try {
        datos = texto ? JSON.parse(texto) : {};
      } catch {
        setError(`El servidor respondió ${res.status} sin explicación.`);
        return;
      }

      if (!res.ok) {
        setError(datos.error ?? "No se pudo validar.");
        return;
      }

      // Validada, pero la subida al CRM puede haber fallado igualmente. Se
      // avisa aquí en vez de dejar que se descubra al abrir la oportunidad.
      if (datos.crm?.error) setError(datos.crm.error);

      router.refresh();
    } catch {
      setError("No hay conexión con el servidor.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <button className="boton" onClick={validar} disabled={enviando}>
        {enviando ? "Validando…" : "Validar y enviar al CRM"}
      </button>
      <p className="traza mt-2 normal-case">
        Validar es lo que sube el PDF a la oportunidad. Hasta entonces el comercial
        puede descargarla y modificarla, pero no llega a GoHighLevel.
      </p>
      {error && <p className="error mt-2">{error}</p>}
    </div>
  );
}