/**
 * Qué partes del alta se muestran y cuáles no.
 *
 * Existe como módulo aparte —y no como tres `if` repartidos por las
 * pantallas— porque las mismas tres reglas se aplican en cuatro sitios: el
 * alta, la edición, el POST y el PATCH. Tenerlas duplicadas garantizaba que
 * antes o después una pantalla ocultara un bloque que el servidor seguía
 * escribiendo en GHL.
 *
 * TypeScript puro: ni Next ni GHL. Y `sector` se tipa como string y no como
 * `Sector` a propósito: lead.ts ya importa rutas.ts, y tipar aquí desde
 * lead.ts cerraría el ciclo.
 */

import { DEFINICION_RUTA, type Ruta } from "./rutas";

/** Clave interna del sector educativo en `SECTORES`. */
export const SECTOR_EDUCACION = "educacion";

/** Clave interna estable de la spin-off educativa (IA con Criterio). No
 *  cambia aunque cambie el nombre comercial. */
export const SPINOFF_EDUCACION = "educacion";

export type ContextoLead = {
  ruta: Ruta | null;
  /** Clave interna, no la etiqueta de GHL. */
  sector?: string | null;
  /** Clave interna de la spin-off elegida, si la ruta es de spin-off. */
  spinoffClave?: string | null;
};

/* ------------------------------------------------------------------ */
/* Reglas                                                              */
/* ------------------------------------------------------------------ */

/** RUTA 7. Un inversor no es un cliente: ni se cualifica ni se presupuesta. */
export function esInversor(ruta: Ruta | null | undefined): boolean {
  return !!ruta && DEFINICION_RUTA[ruta].rolJV === "inversor";
}

/**
 * Institutos y universidades.
 *
 * Se detecta por DOS vías, y basta con una: el sector declarado en el paso de
 * contacto, o la spin-off educativa elegida en el de clasificación. Con solo
 * el sector se escapaba el caso más frecuente —un colegio que entra por la
 * vertical de IA con Criterio, donde el comercial rellena el sector con lo
 * que le parece o lo deja en «Otro»—; con solo la spin-off se escapaba una
 * universidad que llega por consultoría normal.
 *
 * En los dos casos la conversación de «procesos críticos a automatizar»
 * (marketing, ventas, RRHH…) no encaja con cómo compra una institución
 * educativa, que es lo que la regla intenta evitar.
 */
export function esEducacion(
  ctx: Pick<ContextoLead, "sector" | "spinoffClave">,
): boolean {
  return ctx.sector === SECTOR_EDUCACION || ctx.spinoffClave === SPINOFF_EDUCACION;
}

/** El BANT cualifica una compra. Un inversor no compra: aporta capital. */
export function muestraBant(ruta: Ruta | null | undefined): boolean {
  return !esInversor(ruta);
}

/** Los procesos críticos a automatizar: ni inversores ni sector educativo. */
export function muestraProcesosCriticos(ctx: ContextoLead): boolean {
  if (esInversor(ctx.ruta)) return false;
  if (esEducacion(ctx)) return false;
  return true;
}

/**
 * ¿Se le puede generar propuesta a este lead?
 *
 * Un inversor recibe información de inversión —que envía la automatización de
 * GHL, no la app— y nunca un presupuesto. El resto de rutas sí generan
 * documento, aunque algunas salgan sin importe.
 */
export function generaPresupuesto(ruta: Ruta | null | undefined): boolean {
  return !esInversor(ruta);
}

/* ------------------------------------------------------------------ */
/* Interés en información para inversores                              */
/* ------------------------------------------------------------------ */

/** Texto EXACTO de las opciones del campo radio en GHL. Una letra distinta y
 *  el campo se guarda vacío sin dar error, y la automatización no dispara. */
export const ETIQUETA_INFO_INVERSORES = { si: "Sí", no: "No" } as const;

export const etiquetaInfoInversores = (quiere: boolean) =>
  quiere ? ETIQUETA_INFO_INVERSORES.si : ETIQUETA_INFO_INVERSORES.no;
