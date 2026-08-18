"use client";

/**
 * Selector de apariencia. Tres botones en linea en vez de un interruptor de dos
 * posiciones: "sistema" tiene que ser alcanzable, y es lo que la mayoria espera
 * por defecto.
 */
import { Monitor, Moon, Sun } from "lucide-react";
import { useTema, type Tema } from "@/components/tema/proveedor-tema";

const OPCIONES: { valor: Tema; etiqueta: string; Icono: typeof Sun }[] = [
  { valor: "claro", etiqueta: "Claro", Icono: Sun },
  { valor: "oscuro", etiqueta: "Oscuro", Icono: Moon },
  { valor: "sistema", etiqueta: "Sistema", Icono: Monitor },
];

export function InterruptorTema() {
  const { tema, resuelto, setTema } = useTema();

  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Apariencia"
        className="inline-flex rounded-lg border border-linea bg-lienzo p-0.5"
      >
        {OPCIONES.map(({ valor, etiqueta, Icono }) => {
          const activo = tema === valor;
          return (
            <button
              key={valor}
              type="button"
              role="radio"
              aria-checked={activo}
              onClick={() => setTema(valor)}
              className={
                "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors " +
                (activo
                  ? "bg-panel font-medium text-tinta shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                  : "text-tinta-media hover:text-tinta")
              }
            >
              <Icono className="size-4" aria-hidden />
              {etiqueta}
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-xs text-tinta-tenue">
        {tema === "sistema"
          ? `Siguiendo al sistema — ahora mismo en ${resuelto}.`
          : "Preferencia guardada en este navegador."}
      </p>
    </div>
  );
}