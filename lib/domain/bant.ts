/**
 * Cualificación BANT. DERCAS v3.4 — 2.2 (campos BANT), RF-02, RF-03, WF-02.
 * TypeScript puro: ni Next ni GHL. La app calcula el total y se lo manda ya
 * sumado a GHL, esquivando la limitación de Math Operation de ALR-13 para los
 * leads que entran por la App Comercial.
 *
 * Los puntos se manejan internamente en MEDIOS PUNTOS (enteros). La escala usa
 * incrementos de 0,5 y sumar floats en JavaScript da 4.499999999999999. Se
 * divide entre 2 una sola vez, al final.
 */

/* ------------------------------------------------------------------ */
/* Escala                                                              */
/* ------------------------------------------------------------------ */

export const CRITERIOS_BANT = [
  "budget_tiene",
  "budget_rango",
  "authority",
  "need_urgencia",
  "need_impacto",
  "timeline",
] as const;

export type CriterioBant = (typeof CRITERIOS_BANT)[number];

export type OpcionBant = {
  /** Valor interno, estable. Es lo que viaja en el estado del formulario. */
  valor: string;
  /** Texto EXACTO de la opción en GHL. Si cambias la opción allí, cámbiala aquí
   *  o el campo se guardará vacío (mismo contrato que ETIQUETA_FUENTE). */
  etiquetaGhl: string;
  /** Puntos × 2. */
  puntosX2: number;
};

export type PreguntaBant = {
  id: CriterioBant;
  /** Bloque BANT al que pertenece, para agrupar en pantalla. */
  bloque: "Budget" | "Authority" | "Need" | "Timeline";
  /** Etiqueta corta del desplegable. */
  etiqueta: string;
  /** Cómo se le pregunta al cliente en voz alta. Alimenta el asistente guiado:
   *  el comercial está delante del lead, no rellenando una ficha. */
  guion: string;
  /** Máximo del criterio × 2. Se deriva de las opciones, se declara para poder
   *  comprobar en test que la escala sigue sumando 10. */
  maximoX2: number;
  opciones: OpcionBant[];
};

export const PREGUNTAS_BANT: PreguntaBant[] = [
  {
    id: "budget_tiene",
    bloque: "Budget",
    etiqueta: "¿Tiene presupuesto?",
    guion: "¿Tenéis ya una partida asignada para esto, o es algo que todavía hay que aprobar?",
    maximoX2: 4,
    opciones: [
      { valor: "si", etiquetaGhl: "Sí", puntosX2: 4 },
      { valor: "en_evaluacion", etiquetaGhl: "En evaluación", puntosX2: 2 },
      { valor: "no", etiquetaGhl: "No", puntosX2: 0 },
    ],
  },
  {
    id: "budget_rango",
    bloque: "Budget",
    etiqueta: "Rango de inversión",
    guion: "¿En qué orden de magnitud os habéis planteado la inversión?",
    maximoX2: 2,
    opciones: [
      { valor: "mas_50k", etiquetaGhl: "Más de 50K", puntosX2: 2 },
      { valor: "15_50k", etiquetaGhl: "Entre 15 y 50K", puntosX2: 2 },
      { valor: "5_15k", etiquetaGhl: "Entre 5 y 15K", puntosX2: 1 },
      { valor: "menos_5k", etiquetaGhl: "Menos de 5K", puntosX2: 0 },
    ],
  },
  {
    id: "authority",
    bloque: "Authority",
    etiqueta: "¿Es el decisor?",
    guion: "¿Esta decisión la firmas tú, o hay alguien más que tenga que dar el visto bueno?",
    maximoX2: 4,
    opciones: [
      { valor: "si", etiquetaGhl: "Sí", puntosX2: 4 },
      { valor: "no", etiquetaGhl: "No", puntosX2: 0 },
    ],
  },
  {
    id: "need_urgencia",
    bloque: "Need",
    etiqueta: "Nivel de urgencia (1-5)",
    guion: "Del 1 al 5, ¿cuánto te corre resolver esto?",
    maximoX2: 4,
    opciones: [
      { valor: "5", etiquetaGhl: "5", puntosX2: 4 },
      { valor: "4", etiquetaGhl: "4", puntosX2: 3 },
      { valor: "3", etiquetaGhl: "3", puntosX2: 2 },
      { valor: "2", etiquetaGhl: "2", puntosX2: 1 },
      { valor: "1", etiquetaGhl: "1", puntosX2: 0 },
    ],
  },
  {
    id: "need_impacto",
    bloque: "Need",
    etiqueta: "Impacto estimado",
    guion: "Si esto siguiera igual dentro de un año, ¿qué os costaría? ¿Es un incordio o os frena de verdad?",
    maximoX2: 3,
    opciones: [
      { valor: "critico", etiquetaGhl: "Crítico", puntosX2: 3 },
      { valor: "alto", etiquetaGhl: "Alto", puntosX2: 2 },
      { valor: "medio", etiquetaGhl: "Medio", puntosX2: 1 },
      { valor: "bajo", etiquetaGhl: "Bajo", puntosX2: 0 },
    ],
  },
  {
    id: "timeline",
    bloque: "Timeline",
    etiqueta: "Plazo",
    guion: "¿Para cuándo necesitaríais tenerlo funcionando?",
    maximoX2: 3,
    opciones: [
      { valor: "menos_1_mes", etiquetaGhl: "Menos de 1 mes", puntosX2: 3 },
      { valor: "1_3_meses", etiquetaGhl: "Entre 1 y 3 meses", puntosX2: 2 },
      { valor: "mas_3_meses", etiquetaGhl: "Más de 3 meses", puntosX2: 1 },
      { valor: "sin_plazo", etiquetaGhl: "Sin plazo", puntosX2: 0 },
    ],
  },
];

/** El total tiene que seguir siendo 0-10. Si alguien toca la escala, salta aquí
 *  y no tres capas más abajo con un score que ya no significa nada. */
export const MAXIMO_X2 = PREGUNTAS_BANT.reduce((s, p) => s + p.maximoX2, 0);
if (MAXIMO_X2 !== 20) {
  throw new Error(`La escala BANT suma ${MAXIMO_X2 / 2}, tiene que sumar 10.`);
}

/* ------------------------------------------------------------------ */
/* Cálculo                                                             */
/* ------------------------------------------------------------------ */

/** Parcial a propósito: en la captación el comercial responde lo que haya
 *  salido en la conversación. Lo que falte se completa en el diagnóstico. */
export type RespuestasBant = Partial<Record<CriterioBant, string>>;

export const CLASIFICACIONES = ["hot", "warm", "cold"] as const;
export type Clasificacion = (typeof CLASIFICACIONES)[number];

/** RF-03. Los umbrales del DERCAS son enteros (8-10 / 5-7 / 0-4) pero la escala
 *  da medios puntos, así que 7,5 y 4,5 caían en tierra de nadie. Se resuelven
 *  hacia abajo: el corte es >= 8 y >= 5. */
export const CLASIFICACION: Record<
  Clasificacion,
  { etiqueta: string; tag: string; accion: string }
> = {
  hot: {
    etiqueta: "Lead caliente",
    tag: "HOT",
    accion: "Tarea urgente a Jacob: llamar en menos de 24 h. Sin secuencia de email.",
  },
  warm: {
    etiqueta: "Lead templado",
    tag: "WARM",
    accion: "Secuencia de nurturing WARM: 5 emails en 10 días, en su idioma preferido.",
  },
  cold: {
    etiqueta: "Lead frío",
    tag: "COLD",
    accion: "Newsletter mensual. Sin secuencia activa.",
  },
};

export function clasificar(total: number): Clasificacion {
  if (total >= 8) return "hot";
  if (total >= 5) return "warm";
  return "cold";
}

export type ResultadoBant = {
  /** 0-10, con un decimal como mucho. Es lo que se escribe en GHL. */
  total: number;
  clasificacion: Clasificacion;
  respondidas: number;
  /** Las seis contestadas. Mientras sea false, el score es provisional. */
  completo: boolean;
  /** Máximo alcanzable con lo que aún está sin responder. Sirve para no
   *  enfriar un lead que en realidad está a medio cualificar. */
  techo: number;
  sinResponder: CriterioBant[];
};

export function calcularBant(r: RespuestasBant): ResultadoBant {
  let obtenidosX2 = 0;
  let pendientesX2 = 0;
  const sinResponder: CriterioBant[] = [];

  for (const pregunta of PREGUNTAS_BANT) {
    const valor = r[pregunta.id];
    const opcion = pregunta.opciones.find((o) => o.valor === valor);
    if (opcion) {
      obtenidosX2 += opcion.puntosX2;
    } else {
      pendientesX2 += pregunta.maximoX2;
      sinResponder.push(pregunta.id);
    }
  }

  const total = obtenidosX2 / 2;
  return {
    total,
    clasificacion: clasificar(total),
    respondidas: PREGUNTAS_BANT.length - sinResponder.length,
    completo: sinResponder.length === 0,
    techo: (obtenidosX2 + pendientesX2) / 2,
    sinResponder,
  };
}

/* ------------------------------------------------------------------ */
/* Traducción a GHL                                                    */
/* ------------------------------------------------------------------ */

/** Devuelve la etiqueta exacta que espera GHL para una respuesta dada, o
 *  undefined si está sin responder (y entonces el campo no se manda). */
export function etiquetaGhl(criterio: CriterioBant, valor: string | undefined) {
  if (!valor) return undefined;
  return PREGUNTAS_BANT.find((p) => p.id === criterio)?.opciones.find((o) => o.valor === valor)
    ?.etiquetaGhl;
}

/** Puntos individuales del criterio, para los campos `BANT pts *` de GHL.
 *  Se escriben aunque la app ya mande el total: así el dato queda auditable
 *  desde GHL sin tener que recalcular nada a mano. */
export function puntosGhl(criterio: CriterioBant, valor: string | undefined) {
  if (!valor) return undefined;
  const opcion = PREGUNTAS_BANT.find((p) => p.id === criterio)?.opciones.find(
    (o) => o.valor === valor,
  );
  return opcion ? opcion.puntosX2 / 2 : undefined;
}