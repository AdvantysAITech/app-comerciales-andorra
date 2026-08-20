/**
 * Validación y asistente de clasificación. DERCAS v3.4 — RF-16, CA-07a, CA-07b.
 * TypeScript puro: ni Next ni GHL. Toda la lógica de detección vive aquí.
 */
import { z } from "zod";
import { LINEAS, ROLES_JV, type LineaNegocio, type RolJV } from "./tipos";
import { PREGUNTAS_BANT, type CriterioBant } from "./bant";

export const FUENTES = ["linkedin", "referido", "web", "campana", "evento", "otro"] as const;
export type Fuente = (typeof FUENTES)[number];

export const IDIOMAS = ["es", "ca", "en"] as const;
export type Idioma = (typeof IDIOMAS)[number];

/** Texto EXACTO de las opciones en GHL. Si cambias una opción allí, cámbiala aquí. */
export const ETIQUETA_FUENTE: Record<Fuente, string> = {
  linkedin: "LinkedIn",
  referido: "Referido",
  web: "Web Advantys",
  campana: "Campaña",
  evento: "Evento",
  otro: "Otro",
};

export const ETIQUETA_IDIOMA: Record<Idioma, string> = {
  es: "Español",
  ca: "Català",
  en: "English",
};

/* ------------------------------------------------------------------ */
/* Esquema de alta                                                     */
/* ------------------------------------------------------------------ */

/** Las opciones válidas salen de PREGUNTAS_BANT, no de una lista paralela:
 *  si mañana cambia un peso o una opción, el validador cambia con él. */
const opcionesDe = (id: CriterioBant) =>
  PREGUNTAS_BANT.find((p) => p.id === id)!.opciones.map((o) => o.valor) as [string, ...string[]];

/**
 * BANT parcial a propósito (RF-02 lo sitúa en el diagnóstico; aquí se recoge lo
 * que salga en la conversación). Un criterio en blanco no puntúa y no se manda
 * a GHL — no es lo mismo "no tiene presupuesto" que "no se lo he preguntado".
 */
export const bantSchema = z.object({
  budget_tiene: z.enum(opcionesDe("budget_tiene")).optional(),
  budget_rango: z.enum(opcionesDe("budget_rango")).optional(),
  authority: z.enum(opcionesDe("authority")).optional(),
  need_urgencia: z.enum(opcionesDe("need_urgencia")).optional(),
  need_impacto: z.enum(opcionesDe("need_impacto")).optional(),
  timeline: z.enum(opcionesDe("timeline")).optional(),
});

const base = z.object({
  nombre: z.string().trim().min(2, "Escribe nombre y apellidos"),
  email: z.string().trim().email("Revisa el email"),
  telefono: z.string().trim().min(6, "Incluye el prefijo internacional"),
  empresa: z.string().trim().min(2, "Falta la razón social"),
  cargo: z.string().trim().optional(),
  ciudadPais: z.string().trim().min(2, "Indica ciudad y país"),
  web: z.union([z.string().trim().url("La web tiene que empezar por https://"), z.literal("")]).optional(),
  fuente: z.enum(FUENTES),
  idioma: z.enum(IDIOMAS),
  valorEstimado: z.number().nonnegative().optional(),
  pain: z.string().trim().optional(),
  notas: z.string().trim().optional(),
  bant: bantSchema.default({}),
});

/**
 * RF-16: la App Comercial nunca deja un lead sin clasificar.
 * En JV Builder, Spin-off y Rol son obligatorios (CA-07b). El discriminatedUnion
 * hace que sea imposible construir un lead válido sin ellos.
 */
export const leadSchema = z.discriminatedUnion("linea", [
  base.extend({ linea: z.literal("consultoria") }),
  base.extend({
    linea: z.literal("jv_builder"),
    spinoffId: z.string().min(1, "Selecciona la spin-off"),
    spinoffNombre: z.string().min(1, "Selecciona la spin-off"),
    rolJV: z.enum(ROLES_JV, { message: "Selecciona Cliente Final o Inversor" }),
  }),
  base.extend({ linea: z.literal("auditoria_iso42001") }),
]);

export type LeadInput = z.infer<typeof leadSchema>;

/* ------------------------------------------------------------------ */
/* Asistente guiado                                                    */
/* ------------------------------------------------------------------ */

export type RespuestasAsistente = {
  origen?: "evento" | "referido" | "inbound" | "prospeccion";
  mencionaSpinoff?: "si" | "no";
  intencion?: "implantar" | "invertir" | "no_claro";
  preguntaNormativa?: "si" | "no";
};

export type Sugerencia = {
  linea: LineaNegocio;
  rolJV?: RolJV;
  confianza: "alta" | "media" | "baja";
  motivo: string;
};

/**
 * Sugerencia determinista, siempre editable antes de guardar.
 * El orden importa: la señal normativa manda sobre el resto, porque una
 * Auditoría ISO 42001 es una venta distinta (RF-27) y arrastra WF-16.
 */
export function sugerirClasificacion(r: RespuestasAsistente): Sugerencia | null {
  if (r.preguntaNormativa === "si") {
    return {
      linea: "auditoria_iso42001",
      confianza: "alta",
      motivo: "Pregunta por certificación o cumplimiento normativo.",
    };
  }

  if (r.intencion === "invertir") {
    return {
      linea: "jv_builder",
      rolJV: "inversor",
      confianza: r.mencionaSpinoff === "si" ? "alta" : "media",
      motivo:
        r.mencionaSpinoff === "si"
          ? "Quiere invertir y ha nombrado una spin-off concreta."
          : "Quiere invertir, pero todavía no ha nombrado ninguna spin-off.",
    };
  }

  if (r.mencionaSpinoff === "si" && r.intencion === "implantar") {
    return {
      linea: "jv_builder",
      rolJV: "cliente_final",
      confianza: "alta",
      motivo: "Quiere implantar la solución de una spin-off concreta.",
    };
  }

  if (r.intencion === "implantar") {
    return {
      linea: "consultoria",
      confianza: r.origen === "inbound" ? "alta" : "media",
      motivo: "Quiere resolver un proceso de su propia empresa, sin spin-off de por medio.",
    };
  }

  if (r.origen && r.mencionaSpinoff === "no") {
    return {
      linea: "consultoria",
      confianza: "baja",
      motivo: "Sin señales de spin-off ni de inversión. Revísalo antes de guardar.",
    };
  }

  return null;
}

export const PREGUNTAS_ASISTENTE = [
  {
    id: "origen" as const,
    pregunta: "¿De dónde viene el lead?",
    opciones: [
      { valor: "evento", etiqueta: "Un evento o networking" },
      { valor: "referido", etiqueta: "Nos lo han referido" },
      { valor: "inbound", etiqueta: "Nos ha contactado él" },
      { valor: "prospeccion", etiqueta: "Prospección en frío" },
    ],
  },
  {
    id: "mencionaSpinoff" as const,
    pregunta: "¿Ha nombrado alguna spin-off?",
    opciones: [
      { valor: "si", etiqueta: "Sí, una concreta" },
      { valor: "no", etiqueta: "No" },
    ],
  },
  {
    id: "intencion" as const,
    pregunta: "¿Qué quiere hacer?",
    opciones: [
      { valor: "implantar", etiqueta: "Implantar una solución" },
      { valor: "invertir", etiqueta: "Invertir" },
      { valor: "no_claro", etiqueta: "No quedó claro" },
    ],
  },
  {
    id: "preguntaNormativa" as const,
    pregunta: "¿Preguntó por certificación ISO 42001?",
    opciones: [
      { valor: "si", etiqueta: "Sí" },
      { valor: "no", etiqueta: "No" },
    ],
  },
];

export { LINEAS, ROLES_JV };
export type { LineaNegocio, RolJV };