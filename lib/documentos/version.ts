/**
 * La regla de versión, sola.  →  lib/documentos/version.ts
 *
 * Vive aparte de `publicar.ts` porque la usan pantallas que no tienen nada que
 * ver con subir archivos a GoHighLevel: la lista de documentos y la ficha
 * interna. Importar `publicar.ts` desde una página arrastraría react-pdf y el
 * cliente de GHL a un sitio donde no pintan nada.
 *
 * Aquí no hay `server-only` a propósito: son dos funciones puras sobre datos
 * que ya están en la fila, y valen igual en servidor que en navegador.
 */

/** Versión que se está mirando. `ediciones` a 0 es la original, sin editar. */
export const versionDe = (ediciones: number | null) => ediciones ?? 0;

/**
 * ¿Está validada la versión que hay ahora mismo en la fila?
 *
 * Una validación no se revoca nunca (decisión de Jacob, 07/09/2026):
 * `validado_en` se queda donde está. Lo que cambia es que pasa a apuntar a una
 * versión anterior, y entonces la actual está sin validar.
 *
 * Por eso NUNCA se decide con `Boolean(validado_en)`: eso responde «¿se validó
 * alguna vez?», que no es la pregunta.
 */
export function versionValidada(doc: {
  validado_en: string | null;
  validado_version: number | null;
  ediciones: number | null;
}): boolean {
  return doc.validado_en !== null && doc.validado_version === versionDe(doc.ediciones);
}

/** Hubo validación, pero de una versión anterior a la que se está mirando. */
export function validadoAntes(doc: {
  validado_en: string | null;
  validado_version: number | null;
  ediciones: number | null;
}): boolean {
  return doc.validado_en !== null && !versionValidada(doc);
}