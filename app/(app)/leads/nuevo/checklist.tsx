"use client";

import { useMemo } from "react";
import GrabadorAudio from "@/components/audio/grabador";
import {
  preguntasVisibles,
  SPINOFF,
  type Checklist,
  type Pregunta,
  type RespuestasChecklist,
  type ValorRespuesta,
} from "@/lib/domain/checklists";

/**
 * Pinta cualquiera de los siete checklists a partir de su declaración.
 *
 * Una sola pantalla para las siete rutas: añadir una pregunta al dominio es
 * añadir un objeto, no tocar este fichero. Lo contrario —siete formularios
 * escritos a mano— habría sido siete sitios donde arreglar cada cambio de
 * criterio comercial.
 */
export default function RenderChecklist({
  checklist,
  respuestas,
  spinoffClave,
  errores,
  onCambio,
}: {
  checklist: Checklist;
  respuestas: RespuestasChecklist;
  /** Spin-off elegida en la clasificación. Las rutas 6 y 7 condicionan
   *  preguntas a ella (tipo de organización, métrica de dimensión). */
  spinoffClave?: string;
  errores: Record<string, string>;
  onCambio: (id: string, valor: ValorRespuesta | undefined) => void;
}) {
  // La spin-off entra en las respuestas bajo una clave reservada para que
  // `esVisible()` pueda condicionar contra ella sin inventar un mecanismo
  // aparte. No es una pregunta y nunca se pinta.
  const conContexto = useMemo(
    () => (spinoffClave ? { ...respuestas, [SPINOFF]: spinoffClave } : respuestas),
    [respuestas, spinoffClave],
  );

  const visibles = preguntasVisibles(checklist, conContexto);

  return (
    <div className="space-y-8">
      {checklist.intro && (
        <p className="border-l-2 border-accent bg-accent-soft px-5 py-4 text-sm">
          {checklist.intro}
        </p>
      )}

      {visibles.map((p) => (
        <CampoPregunta
          key={p.id}
          pregunta={p}
          valor={respuestas[p.id]}
          respuestas={conContexto}
          checklist={checklist}
          error={errores[p.id]}
          onCambio={(v) => onCambio(p.id, v)}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function CampoPregunta({
  pregunta: p,
  valor,
  respuestas,
  checklist,
  error,
  onCambio,
}: {
  pregunta: Pregunta;
  valor: ValorRespuesta | undefined;
  respuestas: RespuestasChecklist;
  checklist: Checklist;
  error?: string;
  onCambio: (v: ValorRespuesta | undefined) => void;
}) {
  return (
    <div>
      <label className="etiqueta" htmlFor={`p-${p.id}`}>
        {p.enunciado}
        {!p.obligatorio && <span className="text-tinta-tenue"> (opcional)</span>}
      </label>
      {p.ayuda && <p className="mb-2 text-xs text-tinta-tenue">{p.ayuda}</p>}

      <Control
        pregunta={p}
        valor={valor}
        respuestas={respuestas}
        checklist={checklist}
        error={error}
        onCambio={onCambio}
      />

      {error && <p className="error">{error}</p>}
    </div>
  );
}

function Control({
  pregunta: p,
  valor,
  respuestas,
  checklist,
  error,
  onCambio,
}: {
  pregunta: Pregunta;
  valor: ValorRespuesta | undefined;
  respuestas: RespuestasChecklist;
  checklist: Checklist;
  error?: string;
  onCambio: (v: ValorRespuesta | undefined) => void;
}) {
  const id = `p-${p.id}`;
  const invalido = error ? "true" : undefined;

  switch (p.tipo) {
    /* -------------------------------------------------------------- */

    case "seleccion_unica":
      return (
        <div className="flex flex-wrap gap-2">
          {(p.opciones ?? []).map((o) => (
            <button
              key={o.valor}
              type="button"
              className="boton-fantasma"
              data-activo={valor === o.valor}
              title={o.ayuda}
              // Volver a pulsar la opción activa la deselecciona. En una
              // pregunta opcional es la única forma de dejarla en blanco
              // después de haberla tocado por error.
              onClick={() => onCambio(valor === o.valor ? undefined : o.valor)}
            >
              {o.etiqueta}
            </button>
          ))}
        </div>
      );

    /* -------------------------------------------------------------- */

    case "multi_seleccion": {
      const marcadas = Array.isArray(valor) ? valor : [];
      const alternar = (v: string) =>
        onCambio(marcadas.includes(v) ? marcadas.filter((x) => x !== v) : [...marcadas, v]);

      // Dieciséis módulos sueltos no se leen. Si las opciones declaran grupo,
      // se pintan bajo su encabezado; si no, en una sola tanda.
      const grupos = agrupar(p.opciones ?? []);

      return (
        <div className="space-y-4">
          {grupos.map(({ titulo, opciones }) => (
            <div key={titulo ?? "_"}>
              {titulo && <p className="traza mb-2">{titulo}</p>}
              <div className="flex flex-wrap gap-2">
                {opciones.map((o) => (
                  <button
                    key={o.valor}
                    type="button"
                    className="boton-fantasma"
                    data-activo={marcadas.includes(o.valor)}
                    title={o.ayuda}
                    onClick={() => alternar(o.valor)}
                  >
                    {o.etiqueta}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }

    /* -------------------------------------------------------------- */

    case "por_cada": {
      // Una fila por cada opción marcada en la pregunta fuente. Si el comercial
      // vuelve atrás y marca un departamento más, aparece su fila vacía.
      const fuente = checklist.preguntas.find((q) => q.id === p.fuente);
      const marcadas = Array.isArray(respuestas[p.fuente ?? ""])
        ? (respuestas[p.fuente ?? ""] as string[])
        : [];
      const dadas = (valor ?? {}) as Record<string, string>;

      if (marcadas.length === 0) {
        return (
          <p className="text-sm text-tinta-tenue">
            Responde primero la pregunta anterior.
          </p>
        );
      }

      return (
        <div className="space-y-3">
          {marcadas.map((clave) => {
            const etiqueta =
              fuente?.opciones?.find((o) => o.valor === clave)?.etiqueta ?? clave;
            return (
              <div key={clave} className="flex flex-wrap items-center gap-2">
                <span className="min-w-40 text-sm">{etiqueta}</span>
                {(p.opciones ?? []).map((o) => (
                  <button
                    key={o.valor}
                    type="button"
                    className="boton-fantasma"
                    data-activo={dadas[clave] === o.valor}
                    onClick={() => onCambio({ ...dadas, [clave]: o.valor })}
                  >
                    {o.etiqueta}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      );
    }

    /* -------------------------------------------------------------- */

    case "texto":
      return (
        <input
          id={id}
          className="campo"
          type="text"
          value={typeof valor === "string" ? valor : ""}
          aria-invalid={invalido}
          onChange={(e) => onCambio(e.target.value || undefined)}
        />
      );

    case "texto_largo":
      return (
        <textarea
          id={id}
          className="campo"
          rows={4}
          value={typeof valor === "string" ? valor : ""}
          aria-invalid={invalido}
          onChange={(e) => onCambio(e.target.value || undefined)}
        />
      );

    case "numero":
      return (
        <div className="flex items-center gap-2">
          <input
            id={id}
            className="campo"
            type="number"
            inputMode="numeric"
            min={p.min}
            max={p.max}
            value={typeof valor === "number" ? String(valor) : ""}
            aria-invalid={invalido}
            // Vacío es undefined, no cero: "no lo he preguntado" y "cero
            // integraciones" son respuestas distintas y el motor de precios
            // las trata distinto.
            onChange={(e) =>
              onCambio(e.target.value === "" ? undefined : Number(e.target.value))
            }
          />
          {p.unidad && <span className="traza shrink-0">{p.unidad}</span>}
        </div>
      );

    case "fecha":
      return (
        <input
          id={id}
          className="campo"
          type="date"
          value={typeof valor === "string" ? valor : ""}
          aria-invalid={invalido}
          onChange={(e) => onCambio(e.target.value || undefined)}
        />
      );

    /* -------------------------------------------------------------- */

    case "fichero":
      return (
        <div>
          <input
            id={id}
            className="campo"
            type="file"
            multiple
            accept={p.formatos?.join(",")}
            aria-invalid={invalido}
            onChange={(e) => {
              const nombres = Array.from(e.target.files ?? []).map((f) => f.name);
              onCambio(nombres.length ? nombres : undefined);
            }}
          />
          {/* Por ahora solo se guarda el nombre del fichero: la subida real a
              Supabase Storage va con el audio, en la misma entrega. */}
          <p className="traza mt-1.5 normal-case">
            De momento solo queda registrado el nombre. La subida del fichero
            llega en la siguiente entrega.
          </p>
        </div>
      );

    /* -------------------------------------------------------------- */

    case "audio": {
      const escrito = typeof valor === "string" ? valor : "";

      // Lo transcrito se AÑADE al final, separado por una línea en blanco.
      // Sustituir el contenido borraría lo que el comercial acabara de
      // corregir a mano, y grabar dos veces seguidas es lo normal.
      const anexar = (texto: string) => {
        const previo = escrito.trimEnd();
        onCambio(previo ? `${previo}\n\n${texto}` : texto);
      };

      return (
        <div>
          <textarea
            id={id}
            className="campo"
            rows={5}
            value={escrito}
            aria-invalid={invalido}
            onChange={(e) => onCambio(e.target.value || undefined)}
          />

          {/* El teclado no desaparece por tener micrófono: el documento exige
              que todo campo de audio admita escritura directa, para no
              bloquear al comercial en un sitio con ruido o sin permiso. */}
          <GrabadorAudio onTexto={anexar} />

          <p className="traza mt-1.5 normal-case">
            Cuéntalo con detalle: esto es lo que alimenta el documento. Puedes
            grabar varias veces y corregir el texto a mano.
          </p>
        </div>
      );
    }
  }
}

/* ------------------------------------------------------------------ */

function agrupar(opciones: NonNullable<Pregunta["opciones"]>) {
  const grupos: { titulo?: string; opciones: typeof opciones }[] = [];
  for (const o of opciones) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.titulo === o.grupo) ultimo.opciones.push(o);
    else grupos.push({ titulo: o.grupo, opciones: [o] });
  }
  return grupos;
}