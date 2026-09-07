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
 *
 * Desde el 07/09/2026 el árbol se pinta en DOS sitios: T1 —el «interés»— vive
 * en el paso de contacto, y el resto en el de clasificación. Por eso hay
 * `filtro`: el componente y su lógica son los mismos en los dos, y `podar` y
 * `recorrer` siguen viendo el árbol entero. Partirlo en dos componentes
 * habría duplicado justo la parte delicada.
 */
export default function ArbolClasificacion({
  respuestas,
  rutaResuelta,
  onResponder,
  filtro,
  mostrarResultado = true,
}: {
  respuestas: RespuestasArbol;
  rutaResuelta: Ruta | null;
  onResponder: (respuestas: RespuestasArbol, ruta: Ruta | null) => void;
  /** Qué nodos pinta esta instancia. Por defecto, todos. */
  filtro?: (nodoId: string) => boolean;
  /** El recuadro de «Ruta determinada». En el paso 1 sobra: la ruta se
   *  presenta en el paso 2, que es donde el comercial la revisa. */
  mostrarResultado?: boolean;
}) {
  const estado = recorrer(respuestas);
  const visibles = filtro ? estado.camino.filter(filtro) : estado.camino;

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
      {visibles.map((nodoId) => {
        const nodo = ARBOL[nodoId];
        return (
          <div key={nodoId}>
            <p className="etiqueta">{nodo.pregunta}</p>
            <div className="flex flex-col gap-2">
              {nodo.opciones.map((o) => (
                <button
                  key={o.valor}
                  type="button"
                  className="opcion"
                  data-activo={respuestas[nodoId] === o.valor}
                  onClick={() => responder(nodoId, o.valor)}
                >
                  <span>{o.etiqueta}</span>
                  {o.ayuda && <span className="ayuda">{o.ayuda}</span>}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {mostrarResultado && rutaResuelta && (
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