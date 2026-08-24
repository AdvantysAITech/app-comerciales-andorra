"use client";

import {
  ARBOL,
  DEFINICION_RUTA,
  podar,
  recorrer,
  type RespuestasArbol,
  type Ruta,
} from "@/lib/domain/rutas";

/**
 * Las cuatro preguntas del tronco de clasificación (sección 3).
 *
 * El comercial ya no elige "Consultoría / Spin-off / ISO": responde preguntas
 * de negocio y la ruta sale sola. Se muestran todas las contestadas, no solo
 * la actual, para que se pueda corregir una decisión sin empezar de cero.
 */
export default function ArbolClasificacion({
  respuestas,
  rutaResuelta,
  onResponder,
}: {
  respuestas: RespuestasArbol;
  rutaResuelta: Ruta | null;
  onResponder: (respuestas: RespuestasArbol, ruta: Ruta | null) => void;
}) {
  const estado = recorrer(respuestas);

  const responder = (nodo: string, valor: string) => {
    // Podar es lo que evita que quede colgada una respuesta de un camino
    // abandonado: si alguien cambia T1 de "su propia empresa" a "invertir",
    // la respuesta de T3 deja de tener sentido y se descarta.
    const siguientes = podar({ ...respuestas, [nodo]: valor } as RespuestasArbol);
    const resultado = recorrer(siguientes);
    onResponder(siguientes, resultado.estado === "resuelto" ? resultado.ruta : null);
  };

  return (
    <div className="space-y-6">
      {estado.camino.map((nodoId) => {
        const nodo = ARBOL[nodoId];
        return (
          <div key={nodoId}>
            <p className="etiqueta">{nodo.pregunta}</p>
            <div className="flex flex-col gap-2">
              {nodo.opciones.map((o) => (
                <button
                  key={o.valor}
                  type="button"
                  className="boton-fantasma text-left"
                  data-activo={respuestas[nodoId] === o.valor}
                  onClick={() => responder(nodoId, o.valor)}
                >
                  <span className="block">{o.etiqueta}</span>
                  {o.ayuda && (
                    <span className="traza block normal-case opacity-70">{o.ayuda}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {rutaResuelta && (
        <div className="border-l-2 border-accent bg-accent-soft px-5 py-4">
          <p className="traza">Ruta determinada</p>
          <p className="mt-2 font-medium">{DEFINICION_RUTA[rutaResuelta].nombre}</p>
          {DEFINICION_RUTA[rutaResuelta].aviso && (
            <p className="mt-2 text-sm">{DEFINICION_RUTA[rutaResuelta].aviso}</p>
          )}
        </div>
      )}
    </div>
  );
}