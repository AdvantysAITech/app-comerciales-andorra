import type { Ruta } from "../rutas";

export type TipoPregunta =
  | "seleccion_unica"
  | "multi_seleccion"
  | "por_cada"
  | "texto"
  | "texto_largo"
  | "numero"
  | "fecha"
  | "fichero"
  | "audio";

export type OpcionPregunta = {
  valor: string;
  etiqueta: string;
  ayuda?: string;
  grupo?: string;
};

export const MAYOR_QUE_CERO = "__mayor_que_cero__";
export const SPINOFF = "__spinoff__";

export type Condicion = {
  pregunta: string;
  incluye: string[];
};

export type Pregunta = {
  id: string;
  tipo: TipoPregunta;
  enunciado: string;
  ayuda?: string;
  obligatorio: boolean;
  opciones?: OpcionPregunta[];
  minimo?: number;
  fuente?: string;
  min?: number;
  max?: number;
  unidad?: string;
  formatos?: string[];
  condicion?: Condicion;
  reencamina?: Record<string, Ruta>;
};

export type Checklist = {
  ruta: Ruta;
  intro?: string;
  contexto?: string;
  preguntas: Pregunta[];
};

/* ------------------------------------------------------------------ */
/* Respuestas                                                          */
/* ------------------------------------------------------------------ */

/**
 * Forma del valor según el tipo:
 *   seleccion_unica · texto · fecha · audio → string
 *   multi_seleccion · fichero              → string[]
 *   numero                                 → number
 *   por_cada                               → Record<opcion, string>
 */
export type ValorRespuesta = string | string[] | number | Record<string, string>;
export type RespuestasChecklist = Record<string, ValorRespuesta | undefined>;

const vacio = (v: ValorRespuesta | undefined): boolean =>
  v === undefined ||
  v === "" ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0);

/* ------------------------------------------------------------------ */
/* Visibilidad y validación                                            */
/* ------------------------------------------------------------------ */

/** ¿Se cumple la condición de esta pregunta con las respuestas actuales? */
/** ¿Se cumple la condición de esta pregunta con las respuestas actuales? */
export function esVisible(p: Pregunta, r: RespuestasChecklist): boolean {
  if (!p.condicion) return true;
  const valor = r[p.condicion.pregunta];
  if (valor === undefined) return false;
  if (p.condicion.incluye.includes(MAYOR_QUE_CERO)) {
    return typeof valor === "number" && valor > 0;
  }

  const valores = Array.isArray(valor) ? valor : [String(valor)];
  return valores.some((v) => p.condicion!.incluye.includes(v));
}

export function preguntasVisibles(c: Checklist, r: RespuestasChecklist): Pregunta[] {
  return c.preguntas.filter((p) => esVisible(p, r));
}

export function validar(c: Checklist, r: RespuestasChecklist): Record<string, string> {
  const errores: Record<string, string> = {};

  for (const p of preguntasVisibles(c, r)) {
    const valor = r[p.id];

    if (p.obligatorio && vacio(valor)) {
      errores[p.id] = "Falta responder";
      continue;
    }
    if (vacio(valor)) continue;

    if (p.tipo === "multi_seleccion" && p.minimo) {
      const n = Array.isArray(valor) ? valor.length : 0;
      if (n < p.minimo) {
        errores[p.id] = `Marca al menos ${p.minimo}`;
      }
    }

    if (p.tipo === "por_cada" && p.fuente) {
      // Una fila sin responder por cada opción marcada arriba. Se comprueba
      // aquí y no en pantalla porque la fuente puede cambiar después de haber
      // respondido: marcar un departamento más deja una fila nueva en blanco.
      const marcadas = r[p.fuente];
      const filas = Array.isArray(marcadas) ? marcadas : [];
      const dadas = (valor ?? {}) as Record<string, string>;
      const faltan = filas.filter((f) => !dadas[f]);
      if (p.obligatorio && faltan.length > 0) {
        errores[p.id] = `Falta responder ${faltan.length} de ${filas.length}`;
      }
    }

    if (p.tipo === "numero" && typeof valor === "number") {
      if (p.min !== undefined && valor < p.min) errores[p.id] = `Mínimo ${p.min}`;
      if (p.max !== undefined && valor > p.max) errores[p.id] = `Máximo ${p.max}`;
    }
  }

  return errores;
}

/**
 * ¿Alguna respuesta obliga a cambiar de ruta? Se evalúa antes de validar: no
 * tiene sentido exigir la documentación de la RUTA 4 a un lead que, por no
 * traer ninguna, acaba de convertirse en RUTA 2.
 */
export function rutaReencaminada(c: Checklist, r: RespuestasChecklist): Ruta | null {
  for (const p of c.preguntas) {
    if (!p.reencamina) continue;
    const valor = r[p.id];
    if (typeof valor === "string" && p.reencamina[valor]) return p.reencamina[valor];
  }
  return null;
}