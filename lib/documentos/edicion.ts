/**
 * Capa de edición de una propuesta ya generada.
 *
 * Este módulo NO lleva `server-only`: el mismo esquema valida en el navegador
 * antes de enviar y en la ruta antes de guardar. Una sola definición de qué se
 * puede editar, en vez de dos que se separan a la primera de cambio.
 *
 * Lo que NO está aquí es tan importante como lo que sí:
 *
 *   - No hay `horas` en los bloques de alcance. El punto 7.6 saca las horas del
 *     documento de cliente, y un campo editable sería la puerta trasera por la
 *     que volverían a entrar.
 *   - No hay `referencia` ni `fecha`. Se sobrescribe el documento, pero al
 *     menos la referencia y la fecha de emisión siguen siendo las que fueron.
 *   - No hay `notas`. La nota fiscal andorrana del IGI y el aviso de la tasa
 *     del certificador son condiciones legales, no texto comercial: si se
 *     editan a mano acabas mandando condiciones distintas a cada cliente.
 */
import { z } from "zod";

const texto = z.string().trim();

/** Lista de frases sueltas: objetivos, exclusiones, entregables, supuestos. */
const lista = z.array(texto.min(1, "No puede quedar una línea vacía")).max(40);

export const edicionSchema = z
  .object({
    empresa: texto.min(1).max(200).optional(),
    resumen: texto.min(1).optional(),
    contexto: texto.min(1).optional(),
    objetivos: lista.optional(),

    // Bloque y descripción, nada más. Ver el comentario de cabecera.
    incluido: z
      .array(
        z.object({
          bloque: texto.min(1, "El bloque necesita un título"),
          descripcion: texto.min(1, "El bloque necesita una descripción"),
        }),
      )
      .max(40)
      .optional(),

    excluido: lista.optional(),
    entregables: lista.optional(),
    supuestos: lista.optional(),

    plazoSemanas: z
      .object({
        min: z.number().int().positive().max(260),
        max: z.number().int().positive().max(260),
      })
      .refine((p) => p.max >= p.min, {
        message: "El plazo máximo no puede ser menor que el mínimo",
      })
      .optional(),

    hitos: z
      .array(
        z.object({
          concepto: texto.min(1, "El hito necesita un concepto"),
          porcentaje: z.number().min(0).max(100),
        }),
      )
      .min(1)
      .max(6)
      // Se comprueba sobre el redondeo a entero: 33,33 + 33,33 + 33,34 debe
      // pasar. Lo que no puede pasar es una propuesta que sume 90 %.
      .refine((h) => Math.round(h.reduce((s, x) => s + x.porcentaje, 0)) === 100, {
        message: "Los porcentajes de la forma de pago tienen que sumar 100",
      })
      .optional(),

    /** ISO `YYYY-MM-DD`. Se formatea al construir el documento. */
    validoHasta: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida")
      .optional(),
  })
  // `strict`: si el navegador manda un campo que no está en esta lista, la
  // petición se rechaza en vez de guardarlo calladamente en el jsonb.
  .strict();

export type EdicionDocumento = z.infer<typeof edicionSchema>;

/**
 * Cuerpo del PATCH.
 *
 * El precio va suelto y no dentro de `edicion` porque tiene columna propia en
 * la tabla: se consulta en SQL sin abrir el jsonb.
 *
 * Y va SIN suelo ni umbral, por decisión de Jacob del 04/09/2026. El tope de
 * cien millones no es una regla de negocio, es un cortafuegos contra el dedo
 * resbalado en el teclado numérico. `null` significa «vale el calculado».
 */
export const cuerpoEdicionSchema = z.object({
  edicion: edicionSchema,
  precio: z.number().nonnegative().max(100_000_000).nullable(),
});

export type CuerpoEdicion = z.infer<typeof cuerpoEdicionSchema>;

/** Mensajes de Zod en una sola línea, para devolver en el 400. */
export function detalleZod(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join(".") || "cuerpo"}: ${i.message}`).join("; ");
}

/**
 * Estado de la subida al CRM tal y como lo devuelven las rutas de edición y de
 * reintento. Vive aquí, con el contrato de la API, y no dentro de un
 * componente: si lo declarase la pantalla, el formulario tendría que
 * importarlo de ella y las dos quedarían en un ciclo.
 */
export type EstadoCrm = { subidoEn: string | null; error: string | null };
