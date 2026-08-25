"use client";

export type Paso = "contacto" | "clasificacion" | "bant" | "checklist" | "revision";

export const PASOS: { id: Paso; titulo: string }[] = [
  { id: "contacto", titulo: "Contacto" },
  { id: "clasificacion", titulo: "Clasificación" },
  { id: "bant", titulo: "BANT" },
  { id: "checklist", titulo: "Checklist" },
  { id: "revision", titulo: "Revisión" },
];

export function BarraPasos({
  actual,
  alcanzado,
  conError,
  onIr,
}: {
  actual: Paso;
  /** Índice del paso más avanzado que se ha llegado a validar. */
  alcanzado: number;
  /** Pasos que tienen algún campo sin responder ahora mismo. */
  conError: Paso[];
  onIr: (p: Paso) => void;
}) {
  const indiceActual = PASOS.findIndex((p) => p.id === actual);

  return (
    <ol className="mb-8 flex flex-wrap gap-x-2 gap-y-1">
      {PASOS.map((p, i) => {
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
            {i < PASOS.length - 1 && <span className="traza opacity-40">·</span>}
          </li>
        );
      })}
    </ol>
  );
}