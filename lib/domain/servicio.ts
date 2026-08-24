/**
 * Catálogo de Servicio, Modalidad y Estado del presupuesto.
 * TypeScript puro: ni Next ni GHL.
 *
 * Las ETIQUETA_* son el texto EXACTO de las opciones en GHL, copiado del
 * volcado de `npm run ghl:campos`. Mismo contrato que el resto del dominio:
 * una letra o un acento de diferencia y GHL guarda el campo vacío sin avisar.
 */

/* ------------------------------------------------------------------ */
/* Servicio                                                            */
/* ------------------------------------------------------------------ */

export const SERVICIOS = [
  "consultoria_sistema",
  "consultoria_adhoc",
  "implantacion_sistema",
  "implantacion_adhoc",
  "consultoria_iso",
] as const;
export type Servicio = (typeof SERVICIOS)[number];

export const ETIQUETA_SERVICIO: Record<Servicio, string> = {
  consultoria_sistema: "Consultoría Sistema Advantys",
  consultoria_adhoc: "Consultoría IA AdHoc",
  implantacion_sistema: "Implantación Sistema Advantys",
  implantacion_adhoc: "Implantación Proyecto AdHoc",
  consultoria_iso: "Consultoría ISO 42001",
};

/* ------------------------------------------------------------------ */
/* Modalidad                                                           */
/* ------------------------------------------------------------------ */

export const MODALIDADES = ["fee_fijo", "bbhh", "recurrente"] as const;
export type Modalidad = (typeof MODALIDADES)[number];

export const ETIQUETA_MODALIDAD: Record<Modalidad, string> = {
  fee_fijo: "Fee fijo",
  bbhh: "BBHH",
  recurrente: "Recurrente",
};

/* ------------------------------------------------------------------ */
/* Estado del presupuesto                                              */
/* ------------------------------------------------------------------ */

/** En GHL las opciones son constantes en mayúsculas, no texto de cara al
 *  usuario: son el enganche de los workflows WF-A, WF-B y WF-C. */
export const ESTADOS_PRESUPUESTO = [
  "borrador",
  "pendiente_validacion",
  "revision_obligatoria",
  "pendiente_presupuesto",
  "validado",
  "entregado",
] as const;
export type EstadoPresupuesto = (typeof ESTADOS_PRESUPUESTO)[number];

export const ETIQUETA_ESTADO_PRESUPUESTO: Record<EstadoPresupuesto, string> = {
  borrador: "BORRADOR",
  pendiente_validacion: "PENDIENTE_VALIDACION",
  revision_obligatoria: "REVISION_OBLIGATORIA",
  pendiente_presupuesto: "PENDIENTE_PRESUPUESTO",
  validado: "VALIDADO",
  entregado: "ENTREGADO",
};

/** Estado con el que nace toda oportunidad dada de alta desde la App Comercial.
 *
 *  BORRADOR no dispara ningún workflow, y es lo correcto: en la captación
 *  todavía no hay precio que validar. Las transiciones a PENDIENTE_VALIDACION
 *  y PENDIENTE_PRESUPUESTO las produce el motor de precios. Escribirlo desde
 *  ya evita que el campo quede vacío, que es un estado que ningún workflow
 *  sabe interpretar. */
export const ESTADO_PRESUPUESTO_INICIAL: EstadoPresupuesto = "borrador";

/* ------------------------------------------------------------------ */
/* Qué servicios caben en cada línea                                   */
/* ------------------------------------------------------------------ */

import type { LineaNegocio, RolJV } from "./tipos";

/**
 * Servicios ofrecibles según la clasificación del lead.
 *
 * Un inversor no compra un servicio: aporta capital. Devuelve lista vacía y el
 * formulario no pregunta.
 *
 * ⚠ PENDIENTE DE CONFIRMAR: para Cliente Final de una spin-off he asumido que
 * lo que se vende es una implantación (del Sistema Advantys o de un proyecto
 * a medida), nunca una consultoría. Si Jacob quiere ofrecer también las dos
 * de consultoría, se añaden aquí y no hay que tocar nada más.
 */
export function serviciosDisponibles(
  linea: LineaNegocio,
  rolJV?: RolJV,
): readonly Servicio[] {
  if (linea === "iso42001") return ["consultoria_iso"];

  if (linea === "jv_builder") {
    return rolJV === "inversor" ? [] : ["implantacion_sistema", "implantacion_adhoc"];
  }

  return [
    "consultoria_sistema",
    "consultoria_adhoc",
    "implantacion_sistema",
    "implantacion_adhoc",
  ];
}

/** true si el servicio no admite elección y se pone solo (caso ISO 42001). */
export function servicioUnico(linea: LineaNegocio, rolJV?: RolJV): Servicio | null {
  const opciones = serviciosDisponibles(linea, rolJV);
  return opciones.length === 1 ? opciones[0] : null;
}