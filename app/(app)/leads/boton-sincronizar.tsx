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
 *
 * La única confirmación es la del freno: si demasiados leads dan 404 de
 * golpe, el servidor no marca ninguno y devuelve cuáles son. Aquí se enseñan
 * y, si de verdad se borraron en el CRM, «Sí, están borrados» relanza la
 * comprobación con `forzar` y los ids de esa lista, no un «sí» en blanco: el
 * servidor solo marca lo que se vio aquí. Esa segunda pasada vuelve a
 * preguntar a GHL.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

type Resultado = {
  comprobados: number;
  eliminados: number;
  omitidos: number;
  aplazados: number;
  borradores: { comprobados: number; eliminados: number };
  abortado: string | null;
  frenado: boolean;
  pendientes: { id: string; empresa: string | null }[];
};

export default function BotonSincronizar() {
  const router = useRouter();
  const [trabajando, setTrabajando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [problema, setProblema] = useState(false);
  const [pendientes, setPendientes] = useState<Resultado["pendientes"]>([]);

  /** `confirmados`: los ids de la lista que se está enseñando. Solo se pasan
   *  desde «Sí, están borrados»; sin ellos es una comprobación normal. */
  async function sincronizar(confirmados?: string[]) {
    setTrabajando(true);
    setAviso(null);
    setProblema(false);
    setPendientes([]);

    try {
      const res = await fetch("/api/leads/sincronizar-crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          confirmados ? { forzar: true, ids: confirmados } : { forzar: false },
        ),
      });

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
        if (datos.frenado && datos.pendientes?.length) setPendientes(datos.pendientes);
      } else {
        const b = datos.borradores;
        setAviso(
          `${datos.comprobados ?? 0} comprobados · ` +
            `${datos.eliminados ?? 0} ya no están en el CRM` +
            (datos.omitidos ? ` · ${datos.omitidos} sin respuesta, se reintentan mañana` : "") +
            (datos.aplazados
              ? ` · ${datos.aplazados} sin mirar por falta de tiempo, van primero la próxima vez`
              : "") +
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
      <button className="boton-fantasma" onClick={() => sincronizar()} disabled={trabajando}>
        {trabajando ? "Comprobando…" : "Actualizar desde CRM"}
      </button>
      {aviso && (
        <p className="traza max-w-md text-right normal-case" data-error={problema ? "true" : undefined}>
          {aviso}
        </p>
      )}
      {pendientes.length > 0 && (
        <div className="flex max-w-md flex-col items-end gap-2">
          <ul className="traza text-right normal-case">
            {pendientes.map((p) => (
              <li key={p.id}>{p.empresa || "Sin empresa"}</li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button className="boton-fantasma" onClick={() => setPendientes([])} disabled={trabajando}>
              Revisar primero
            </button>
            <button
              className="boton-fantasma"
              onClick={() => sincronizar(pendientes.map((p) => p.id))}
              disabled={trabajando}
            >
              Sí, están borrados
            </button>
          </div>
        </div>
      )}
    </div>
  );
}