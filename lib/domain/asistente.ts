/**
 * Asistente de desempate T5. Sección 3 del documento definitivo.
 *
 * Sustituye a `sugerirClasificacion()` de lead.ts, que sugería una de tres
 * líneas de negocio. Ahora sugiere una de las siete rutas, que es una decisión
 * más fina: la línea sale sola de la ruta.
 *
 * Determinista a propósito. Aquí no interviene ninguna IA: son cuatro señales
 * y un orden de prioridad. Que el comercial pueda predecir qué va a sugerir el
 * asistente es una virtud, no una limitación.
 */

import type { Ruta } from "./rutas";

export const PREGUNTAS_T5 = [
  {
    id: "origen" as const,
    pregunta: "¿De qué conversación viene el lead?",
    opciones: [
      { valor: "referido", etiqueta: "Referido" },
      { valor: "evento", etiqueta: "Evento" },
      { valor: "web", etiqueta: "Web" },
      { valor: "linkedin", etiqueta: "LinkedIn" },
      { valor: "campana", etiqueta: "Campaña" },
    ],
  },
  {
    id: "vertical" as const,
    pregunta: "¿Ha mencionado alguna de nuestras verticales por su nombre?",
    /** Las opciones se construyen en pantalla desde la caché de spin-offs:
     *  la lista es viva y no se hardcodea (sección 9.3). */
    opciones: [] as { valor: string; etiqueta: string }[],
  },
  {
    id: "intencion" as const,
    pregunta: "¿Habla de comprar una solución o de poner dinero en una empresa?",
    opciones: [
      { valor: "comprar", etiqueta: "Comprar" },
      { valor: "invertir", etiqueta: "Invertir" },
      { valor: "no_claro", etiqueta: "No está claro" },
    ],
  },
  {
    id: "normativa" as const,
    pregunta: "¿Ha mencionado normativa, certificación, AI Act o auditoría?",
    opciones: [
      { valor: "si", etiqueta: "Sí" },
      { valor: "no", etiqueta: "No" },
    ],
  },
];

export type RespuestasT5 = {
  origen?: string;
  /** Clave interna de la spin-off mencionada, o "no". */
  vertical?: string;
  intencion?: "comprar" | "invertir" | "no_claro";
  normativa?: "si" | "no";
};

export type SugerenciaRuta = {
  ruta: Ruta;
  /** Si el comercial nombró una vertical, se arrastra y se preselecciona. */
  spinoffClave?: string;
  confianza: "alta" | "media" | "baja";
  motivo: string;
};

/**
 * El ORDEN de las reglas es la parte importante, no las reglas en sí.
 *
 * La señal normativa manda sobre todo lo demás: si alguien pregunta por el AI
 * Act, esa conversación es ISO 42001 aunque de paso hable de automatizar su
 * marketing. Después manda la intención de invertir, porque distingue las dos
 * rutas de spin-off, que acaban en pipelines distintos y son irreconciliables.
 * La vertical mencionada solo desempata cuando ya sabemos que quiere comprar.
 */
export function sugerirRuta(r: RespuestasT5): SugerenciaRuta | null {
  const vertical = r.vertical && r.vertical !== "no" ? r.vertical : undefined;

  if (r.normativa === "si") {
    return {
      ruta: "ruta_5",
      confianza: "alta",
      motivo: "Ha hablado de certificación o cumplimiento normativo.",
    };
  }

  if (r.intencion === "invertir") {
    return {
      ruta: "ruta_7",
      spinoffClave: vertical,
      confianza: vertical ? "alta" : "media",
      motivo: vertical
        ? "Quiere invertir y ha nombrado una vertical concreta."
        : "Quiere invertir, pero todavía no ha nombrado ninguna vertical.",
    };
  }

  if (vertical && r.intencion === "comprar") {
    return {
      ruta: "ruta_6",
      spinoffClave: vertical,
      confianza: "alta",
      motivo: "Quiere implantar la solución de una vertical concreta.",
    };
  }

  if (vertical && r.intencion === "no_claro") {
    return {
      ruta: "ruta_6",
      spinoffClave: vertical,
      confianza: "baja",
      motivo:
        "Ha nombrado una vertical, pero no ha quedado claro si quiere comprarla " +
        "o invertir en ella. Pregúntaselo antes de guardar.",
    };
  }

  if (r.intencion === "comprar") {
    // Sin vertical y sin señal normativa, el lead es de su propia empresa. Se
    // sugiere la ruta 1 y no la 3 a propósito: la 3 exige que el cliente ya
    // sepa qué módulos quiere, y alguien que necesita un asistente para ser
    // clasificado no ha dado esa señal. Entre equivocarse vendiendo análisis
    // o vendiendo implantación, el error barato es el primero.
    return {
      ruta: "ruta_1",
      confianza: r.origen === "web" ? "media" : "baja",
      motivo:
        "Quiere resolver algo de su propia empresa, sin vertical ni normativa " +
        "de por medio. Recorre el árbol para afinar si es Sistema Advantys o " +
        "un proceso concreto con IA.",
    };
  }

  return null;
}