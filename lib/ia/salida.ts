/**
 * Parseo estricto de lo que devuelve la IA (7.3) y separación de los dos
 * documentos (7.6).
 */
import "server-only";
import { z } from "zod";

export const alcanceSchema = z.object({
  resumen_ejecutivo: z.string().min(1),
  contexto: z.string().min(1),
  objetivos: z.array(z.string()).min(1),
  alcance_incluido: z
    .array(
      z.object({
        bloque: z.string().min(1),
        descripcion: z.string().min(1),
        horas_min: z.number().nonnegative(),
        horas_max: z.number().nonnegative(),
      }),
    )
    .min(1),
  alcance_excluido: z.array(z.string()).default([]),
  supuestos: z.array(z.string()).default([]),
  riesgos: z.array(z.string()).default([]),
  entregables: z.array(z.string()).min(1),
  plazo_estimado_semanas: z.object({
    min: z.number().positive(),
    max: z.number().positive(),
  }),
  confianza: z.enum(["alta", "media", "baja"]),
  avisos: z.array(z.string()).default([]),
});

export type Alcance = z.infer<typeof alcanceSchema>;

/**
 * Extrae el JSON aunque la IA lo envuelva.
 *
 * El prompt lo prohíbe expresamente, pero un modelo que un día devuelva
 * ```json alrededor no debería tumbar un alta: se recorta del primer { al
 * último } y se intenta igualmente. Si tras eso no parsea, sí es un fallo.
 */
export function extraerJson(texto: string): unknown {
  const limpio = texto.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const inicio = limpio.indexOf("{");
  const fin = limpio.lastIndexOf("}");
  if (inicio === -1 || fin === -1) throw new Error("La IA no devolvió un objeto JSON");
  return JSON.parse(limpio.slice(inicio, fin + 1));
}

export function parsearAlcance(texto: string): Alcance {
  const bruto = extraerJson(texto);
  const parsed = alcanceSchema.safeParse(bruto);
  if (!parsed.success) {
    const detalle = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`El JSON de la IA no cumple el esquema — ${detalle}`);
  }
  return parsed.data;
}

/** Horas totales estimadas. Solo para el control de coherencia y el documento
 *  interno: NUNCA sale hacia el cliente ni hacia el comercial. */
export function horasEstimadas(a: Alcance): number {
  const total = a.alcance_incluido.reduce((s, b) => s + (b.horas_min + b.horas_max) / 2, 0);
  return Math.round(total);
}

/**
 * Versión del alcance apta para el documento de cliente (7.6).
 *
 * Se le quitan las horas de cada bloque. La tabla de 7.6 es tajante: horas por
 * bloque "NUNCA" al cliente. El motivo es comercial, no de secreto: si el
 * cliente ve horas, negocia horas — y un sistema completo se monta en dos o
 * tres semanas sobre snapshot. Se vende valor, no tiempo.
 *
 * Los riesgos se dejan fuera enteros: la sección 7.6 dice que al cliente solo
 * van "los que le afectan", y esa criba la hace Jacob al validar, no un filtro
 * automático que no sabe distinguirlos.
 */
export function paraCliente(a: Alcance) {
  return {
    resumen_ejecutivo: a.resumen_ejecutivo,
    contexto: a.contexto,
    objetivos: a.objetivos,
    alcance_incluido: a.alcance_incluido.map(({ bloque, descripcion }) => ({
      bloque,
      descripcion,
    })),
    alcance_excluido: a.alcance_excluido,
    supuestos: a.supuestos,
    entregables: a.entregables,
    plazo_estimado_semanas: a.plazo_estimado_semanas,
  };
}