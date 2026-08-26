"use client";

import type { Ruta } from "@/lib/domain/rutas";
import { muestraBant } from "@/lib/domain/visibilidad";

export type Paso = "contacto" | "clasificacion" | "bant" | "checklist" | "revision";

export type PasoRef = { id: Paso; titulo: string };

/** Los cinco pasos posibles, en orden. Ninguna pantalla debería iterar sobre
 *  esta lista directamente: usa `pasosDe(ruta)`, que quita los que no
 *  aplican. Se exporta porque es la fuente del orden. */
export const PASOS: PasoRef[] = [
  { id: "contacto", titulo: "Contacto" },
  { id: "clasificacion", titulo: "Clasificación" },
  { id: "bant", titulo: "BANT" },
  { id: "checklist", titulo: "Checklist" },
  { id: "revision", titulo: "Revisión" },
];

/**
 * Los pasos vigentes para una ruta.
 *
 * Mientras no hay ruta (paso 1) se muestran los cinco: quitar el BANT antes
 * de saber si el lead es inversor haría que la barra cambiara de longitud dos
 * veces seguidas. En cuanto el árbol resuelve RUTA 7, desaparece.
 *
 * Importante para quien lo use: los índices son de ESTA lista, no de PASOS.
 * `contacto` y `clasificacion` son siempre 0 y 1, pero `revision` es 4 o 3
 * según la ruta.
 */
export function pasosDe(ruta: Ruta | null): PasoRef[] {
  if (muestraBant(ruta)) return PASOS;
  return PASOS.filter((p) => p.id !== "bant");
}

export function BarraPasos({
  pasos,
  actual,
  alcanzado,
  conError,
  onIr,
}: {
  /** Los pasos vigentes, ya filtrados por ruta. */
  pasos: PasoRef[];
  actual: Paso;
  /** Índice —dentro de `pasos`— del paso más avanzado que se ha validado. */
  alcanzado: number;
  /** Pasos que tienen algún campo sin responder ahora mismo. */
  conError: Paso[];
  onIr: (p: Paso) => void;
}) {
  const indiceActual = pasos.findIndex((p) => p.id === actual);

  return (
    <ol className="mb-8 flex flex-wrap gap-x-2 gap-y-1">
      {pasos.map((p, i) => {
        const navegable = i <= alcanzado;
        return (
          <li key={p.id} className="flex items-center gap-2">
            <button
              type="button"
              disabled={!navegable}
              onClick={() => navegable && onIr(p.id)}
              className="traza disabled:opacity-40"
              data-activo={i === indiceActual}
              data-error={conError.includes(p.id) || undefined}
              aria-current={i === indiceActual ? "step" : undefined}
            >
              {i + 1}. {p.titulo}
            </button>
            {i < pasos.length - 1 && <span className="traza opacity-40">·</span>}
          </li>
        );
      })}
    </ol>
  );
}
