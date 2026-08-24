import { z } from "zod";
import { LINEAS, ROLES_JV, type LineaNegocio, type RolJV } from "./tipos";
import { PREGUNTAS_BANT, type CriterioBant } from "./bant";
import { SERVICIOS, MODALIDADES, serviciosDisponibles, type Servicio } from "./servicio";

export const FUENTES = [
  "linkedin",
  "referido",
  "web",
  "campana",
  "camara_andorra",
  "evento",
  "otro",
] as const;
export type Fuente = (typeof FUENTES)[number];

export const IDIOMAS = ["es", "ca", "en"] as const;
export type Idioma = (typeof IDIOMAS)[number];

export const ETIQUETA_FUENTE: Record<Fuente, string> = {
  linkedin: "LinkedIn",
  referido: "Referido",
  web: "Web",
  campana: "Campaña",
  camara_andorra: "Cámara de comercio Andorra",
  evento: "Evento",
  otro: "Otro",
};

export const ETIQUETA_IDIOMA: Record<Idioma, string> = {
  es: "Español",
  ca: "Català",
  en: "English",
};

export const SECTORES = [
  "educacion",
  "hosteleria",
  "agroalimentario",
  "financiero",
  "inmobiliario",
  "industrial",
  "retail",
  "salud",
  "administracion_publica",
  "otro",
] as const;
export type Sector = (typeof SECTORES)[number];

export const EMPLEADOS = ["1_10", "11_50", "51_100", "101_200", "mas_200"] as const;
export type Empleados = (typeof EMPLEADOS)[number];

export const FACTURACION = ["menos_2m", "2_10m", "10_50m", "mas_50m"] as const;
export type Facturacion = (typeof FACTURACION)[number];

/** Texto EXACTO de las opciones en GHL. Mismo contrato que ETIQUETA_FUENTE:
 *  una letra de diferencia y el campo se guarda vacío sin dar error. */
export const ETIQUETA_SECTOR: Record<Sector, string> = {
  educacion: "Educación",
  hosteleria: "Hostelería / Turismo",
  agroalimentario: "Agroalimentario",
  financiero: "Servicios Financieros",
  inmobiliario: "Residencial / Inmobiliario",
  industrial: "Industrial / Manufactura",
  retail: "Retail",
  salud: "Salud",
  administracion_publica: "Administración Pública",
  otro: "Otro",
};

export const ETIQUETA_EMPLEADOS: Record<Empleados, string> = {
  "1_10": "De 1 a 10",
  "11_50": "De 11 a 50",
  "51_100": "De 51 a 100",
  "101_200": "De 101 a 200",
  mas_200: "Más de 200",
};

export const ETIQUETA_FACTURACION: Record<Facturacion, string> = {
  menos_2m: "Menos de 2M",
  "2_10m": "Entre 2 y 10M",
  "10_50m": "Entre 10 y 50M",
  mas_50m: "Más de 50M",
};

export const PROCESOS = [
  "ventas",
  "marketing",
  "rrhh",
  "finanzas",
  "operaciones",
  "otro",
] as const;
export type Proceso = (typeof PROCESOS)[number];

export const ETIQUETA_PROCESO: Record<Proceso, string> = {
  ventas: "Ventas",
  marketing: "Marketing",
  rrhh: "RRHH",
  finanzas: "Finanzas",
  operaciones: "Operaciones",
  otro: "Otro",
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
  uuid: z.uuid("Falta el identificador del lead"),
  bant: bantSchema.default({}),
  sector: z.enum(SECTORES),
  empleados: z.enum(EMPLEADOS),
  facturacion: z.enum(FACTURACION),
  herramientas: z.string().trim().optional(),
  servicio: z.enum(SERVICIOS).optional(),
  modalidad: z.enum(MODALIDADES).optional(),
  procesos: z.array(z.enum(PROCESOS)).default([]),
});

const leadUnion = z.discriminatedUnion("linea", [
  base.extend({ linea: z.literal("consultoria") }),
  base.extend({ linea: z.literal("iso42001") }),
  base.extend({
    linea: z.literal("jv_builder"),
    spinoffClave: z.string().min(1, "Selecciona la spin-off"),
    rolJV: z.enum(ROLES_JV, { message: "Selecciona Cliente Final o Inversor" }),
  }),
]);

export const leadSchema = leadUnion.superRefine((lead, ctx) => {
  const disponibles = serviciosDisponibles(
    lead.linea,
    lead.linea === "jv_builder" ? lead.rolJV : undefined,
  );

  if (disponibles.length === 0) return;

  if (!lead.servicio) {
    ctx.addIssue({
      code: "custom",
      path: ["servicio"],
      message: "Selecciona el servicio",
    });
    return;
  }

  if (!(disponibles as readonly string[]).includes(lead.servicio)) {
    ctx.addIssue({
      code: "custom",
      path: ["servicio"],
      message: "Ese servicio no corresponde a esta clasificación",
    });
  }
});

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
      linea: "iso42001",
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
export { SERVICIOS, MODALIDADES, serviciosDisponibles, servicioUnico } from "./servicio";
export { ETIQUETA_SERVICIO, ETIQUETA_MODALIDAD } from "./servicio";
export type { Servicio, Modalidad } from "./servicio";