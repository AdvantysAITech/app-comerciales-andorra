/**
 * Construye el JSON que se le pasa a Claude. Sección 7.2 del documento.
 *
 * ⚠ Este fichero decide qué información sale de Advantys hacia una API
 * externa. Todo lo que entre aquí acaba en el prompt, así que la sección 8 se
 * aplica con la misma dureza que en la interfaz: NO viajan tarifas, ni horas
 * internas, ni el suelo de negociación, ni el desglose de precio.
 *
 * La IA recibe el precio YA CALCULADO y su trabajo es redactar sobre él, no
 * estimarlo (7.3: "en rutas 1, 3 y 5 la IA no estima precio").
 */
import "server-only";

import { DEFINICION_RUTA, ETIQUETA_RUTA, type Ruta } from "@/lib/domain/rutas";
import { ETIQUETA_SERVICIO } from "@/lib/domain/servicio";
import {
  CHECKLISTS,
  esVisible,
  SPINOFF,
  type RespuestasChecklist,
  type ValorRespuesta,
} from "@/lib/domain/checklists";
import { ETIQUETA_SECTOR, ETIQUETA_EMPLEADOS, ETIQUETA_FACTURACION } from "@/lib/domain/lead";
import type { ResultadoBant } from "@/lib/domain/bant";
import type { Calculo } from "@/lib/precios";

export type DatosCliente = {
  empresa: string;
  sector: string;
  empleados: string;
  facturacion: string;
  ciudadPais: string;
};

export type ProyectoReferencia = {
  nombre: string;
  horas: number;
  alcance: string;
};

/** Referencia de anclaje inicial (7.4). Su sitio definitivo es la tabla
 *  `proyectos_referencia` de Supabase; esto es la semilla. */
export const REFERENCIA_SISTEMA: ProyectoReferencia = {
  nombre: "Plataforma Advantys (sistema propio)",
  horas: 200,
  alcance: "Sistema completo, 15 módulos, 4 áreas, montado sobre snapshot",
};

export type EntradaIa = {
  ruta: string;
  servicio: string | null;
  cliente: DatosCliente;
  bant: { score: number | null; clasificacion: string | null };
  checklist: Record<string, unknown>;
  contexto_libre: string;
  precio_calculado: number | null;
  referencia?: ProyectoReferencia;
  spinoff?: string;
};

/**
 * Traduce las respuestas del checklist a texto legible.
 *
 * Mandarle a Claude `{"R3.1": ["M01","V01"], "R3.4": "1000_10000"}` sería
 * pedirle que adivine qué son esas claves. Aquí se sustituyen por el enunciado
 * de la pregunta y la etiqueta de cada opción, que es lo que el comercial vio
 * en pantalla y lo que el cliente dijo en la reunión.
 *
 * Solo entran las preguntas VISIBLES: una pregunta oculta por su condición no
 * se le preguntó a nadie, y su ausencia es información, no un hueco.
 */
export function checklistLegible(
  ruta: Ruta,
  respuestas: RespuestasChecklist,
): Record<string, unknown> {
  const checklist = CHECKLISTS[ruta];
  const salida: Record<string, unknown> = {};

  for (const p of checklist.preguntas) {
    if (!esVisible(p, respuestas)) continue;

    const valor = respuestas[p.id];
    if (valor === undefined || valor === "") continue;

    // El campo de contexto va aparte, en `contexto_libre`: es el texto en
    // palabras del cliente y merece su propio sitio en el prompt.
    if (p.id === checklist.contexto) continue;

    salida[p.enunciado] = legible(p.opciones, valor);
  }

  return salida;
}

function legible(
  opciones: { valor: string; etiqueta: string }[] | undefined,
  valor: ValorRespuesta,
): unknown {
  const etiqueta = (v: string) =>
    opciones?.find((o) => o.valor === v)?.etiqueta ?? v;

  if (Array.isArray(valor)) return valor.map(etiqueta);
  if (typeof valor === "number") return valor;
  if (typeof valor === "object") {
    // Las preguntas "por cada": {departamento: rango} → {etiqueta: etiqueta}
    return Object.fromEntries(
      Object.entries(valor).map(([k, v]) => [k, etiqueta(v)]),
    );
  }
  return etiqueta(valor);
}

export function construirEntrada(args: {
  ruta: Ruta;
  respuestas: RespuestasChecklist;
  cliente: DatosCliente;
  bant: ResultadoBant;
  calculo: Calculo;
  spinoffNombre?: string;
}): EntradaIa {
  const { ruta, respuestas, cliente, bant, calculo } = args;
  const definicion = DEFINICION_RUTA[ruta];
  const checklist = CHECKLISTS[ruta];

  const idContexto = checklist.contexto;
  const contexto = idContexto ? respuestas[idContexto] : undefined;

  return {
    ruta: ETIQUETA_RUTA[ruta],
    servicio: definicion.servicio ? ETIQUETA_SERVICIO[definicion.servicio] : null,
    cliente,
    bant: {
      score: bant.respondidas > 0 ? bant.total : null,
      clasificacion: bant.respondidas > 0 ? bant.clasificacion.toUpperCase() : null,
    },
    checklist: checklistLegible(ruta, respuestas),
    contexto_libre: typeof contexto === "string" ? contexto : "",
    // El importe ya calculado. La IA redacta sobre él; no lo recalcula ni lo
    // discute. Null en las rutas 4, 6 y 7, que no llevan precio.
    precio_calculado: calculo.presentado,
    // Solo tiene sentido anclar contra el sistema propio en la ruta que lo vende.
    ...(ruta === "ruta_3" ? { referencia: REFERENCIA_SISTEMA } : {}),
    ...(args.spinoffNombre ? { spinoff: args.spinoffNombre } : {}),
  };
}

/** Helper para el endpoint: arma DatosCliente desde el lead validado. */
export function datosCliente(lead: {
  empresa: string;
  sector: keyof typeof ETIQUETA_SECTOR;
  empleados: keyof typeof ETIQUETA_EMPLEADOS;
  facturacion: keyof typeof ETIQUETA_FACTURACION;
  ciudadPais: string;
}): DatosCliente {
  return {
    empresa: lead.empresa,
    sector: ETIQUETA_SECTOR[lead.sector],
    empleados: ETIQUETA_EMPLEADOS[lead.empleados],
    facturacion: ETIQUETA_FACTURACION[lead.facturacion],
    ciudadPais: lead.ciudadPais,
  };
}