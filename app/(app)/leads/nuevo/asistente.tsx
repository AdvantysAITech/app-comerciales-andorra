"use client";

import { useState } from "react";
import {
  PREGUNTAS_ASISTENTE,
  sugerirClasificacion,
  type RespuestasAsistente,
  type Sugerencia,
} from "@/lib/domain/lead";
import { ETIQUETA_LINEA, ETIQUETA_ROL } from "@/lib/domain/tipos";

const TEXTO_CONFIANZA: Record<Sugerencia["confianza"], string> = {
  alta: "Confianza alta",
  media: "Confianza media",
  baja: "Confianza baja — revísalo",
};

export default function Asistente({
  onAplicar,
  onCerrar,
}: {
  onAplicar: (s: Sugerencia) => void;
  onCerrar: () => void;
}) {
  const [respuestas, setRespuestas] = useState<RespuestasAsistente>({});

  const responder = (id: string, valor: string) =>
    setRespuestas((r) => ({ ...r, [id]: valor }));

  // Se revela una pregunta cada vez, pero todas quedan visibles y editables:
  // el comercial puede corregir una respuesta sin empezar de cero.
  const visibles = PREGUNTAS_ASISTENTE.filter((p, i) => {
    if (i === 0) return true;
    const anterior = PREGUNTAS_ASISTENTE[i - 1].id;
    return respuestas[anterior] !== undefined;
  });

  const sugerencia = sugerirClasificacion(respuestas);
  const completo = PREGUNTAS_ASISTENTE.every((p) => respuestas[p.id] !== undefined);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Asistente de clasificación"
    >
      <div className="max-h-[88dvh] w-full overflow-y-auto border-t border-line bg-surface p-6 sm:max-w-lg sm:border">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="traza">Asistente</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">
              ¿De qué tipo de lead se trata?
            </h2>
          </div>
          <button className="traza hover:text-accent" onClick={onCerrar}>
            Cerrar
          </button>
        </div>

        <div className="mt-6 space-y-6">
          {visibles.map((p) => (
            <div key={p.id}>
              <p className="etiqueta">{p.pregunta}</p>
              <div className="flex flex-wrap gap-2">
                {p.opciones.map((o) => (
                  <button
                    key={o.valor}
                    type="button"
                    className="boton-fantasma"
                    data-activo={respuestas[p.id] === o.valor}
                    onClick={() => responder(p.id, o.valor)}
                  >
                    {o.etiqueta}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {sugerencia && (
          <div className="mt-7 border-l-2 border-accent bg-accent-soft px-5 py-4">
            <p className="traza">Sugerencia · {TEXTO_CONFIANZA[sugerencia.confianza]}</p>
            <p className="mt-2 font-medium">
              {ETIQUETA_LINEA[sugerencia.linea]}
              {sugerencia.rolJV ? ` · ${ETIQUETA_ROL[sugerencia.rolJV]}` : ""}
            </p>
            <p className="mt-1 text-sm text-muted">{sugerencia.motivo}</p>
            {!completo && (
              <p className="traza mt-3 normal-case">
                Puedes responder el resto para afinarla.
              </p>
            )}
          </div>
        )}

        <div className="mt-7 flex items-center gap-4">
          <button
            className="boton"
            disabled={!sugerencia}
            onClick={() => sugerencia && onAplicar(sugerencia)}
          >
            Aplicar clasificación
          </button>
          <button className="traza hover:text-accent" onClick={onCerrar}>
            Clasificar a mano
          </button>
        </div>

        <p className="traza mt-4 normal-case">
          La sugerencia es orientativa. Siempre puedes cambiarla antes de guardar.
        </p>
      </div>
    </div>
  );
}