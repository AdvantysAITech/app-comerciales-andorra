"use client";

/**
 * Botón «Actualizar desde CRM».  →  app/(app)/leads/boton-sincronizar.tsx
 *
 * Dispara la misma comprobación que el cron de las cuatro de la madrugada,
 * pero cuando hace falta: después de una limpieza en GoHighLevel, o en los
 * despliegues de preview, donde Vercel no ejecuta crons y esperar a mañana no
 * sirve de nada.
 *
 * No pide confirmación a propósito. La operación no destruye nada: marca
 * `eliminado_en` en lo que GHL dice que ya no existe, y una marca puesta por
 * error se quita con una fecha a null.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

type Resultado = {
  comprobados: number;
  eliminados: number;
  omitidos: number;
  borradores: { comprobados: number; eliminados: number };
  abortado: string | null;
};

export default function BotonSincronizar() {
  const router = useRouter();
  const [trabajando, setTrabajando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [problema, setProblema] = useState(false);

  async function sincronizar() {
    setTrabajando(true);
    setAviso(null);
    setProblema(false);

    try {
      const res = await fetch("/api/leads/sincronizar-crm", { method: "POST" });

      // Si no es JSON —un 405, un 502 del proxy— `json()` lanza y el catch
      // culparía a la conexión, que es lo que despistó con el botón de
      // validar. Se lee como texto y se decide.
      const texto = await res.text();
      let datos: Partial<Resultado> & { error?: string } = {};
      try {
        datos = texto ? JSON.parse(texto) : {};
      } catch {
        setProblema(true);
        setAviso(`El servidor respondió ${res.status} sin explicación.`);
        return;
      }

      if (!res.ok) {
        setProblema(true);
        setAviso(datos.error ?? "No se pudo sincronizar.");
        return;
      }

      if (datos.abortado) {
        setProblema(true);
        setAviso(datos.abortado);
      } else {
        const b = datos.borradores;
        setAviso(
          `${datos.comprobados ?? 0} comprobados · ` +
            `${datos.eliminados ?? 0} ya no están en el CRM` +
            (datos.omitidos ? ` · ${datos.omitidos} sin respuesta, se reintentan mañana` : "") +
            (b ? ` · borradores: ${b.comprobados} comprobados, ${b.eliminados} marcados` : ""),
        );
      }

      router.refresh();
    } catch {
      setProblema(true);
      setAviso("No hay conexión con el servidor.");
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button className="boton-fantasma" onClick={sincronizar} disabled={trabajando}>
        {trabajando ? "Comprobando…" : "Actualizar desde CRM"}
      </button>
      {aviso && (
        <p className="traza max-w-md text-right normal-case" data-error={problema ? "true" : undefined}>
          {aviso}
        </p>
      )}
    </div>
  );
}