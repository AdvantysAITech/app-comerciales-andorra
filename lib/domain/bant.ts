/**
 * Cualificación BANT. Escala de la especificación de la App Comercial
 * (sección 4.2), que sustituye a la de RF-03 del DERCAS.
 * TypeScript puro: ni Next ni GHL. La app calcula el total y se lo manda ya
 * sumado a GHL, esquivando la limitación de Math Operation de ALR-13 para los
 * leads que entran por la App Comercial.
 *
 * Los puntos se manejan internamente en CENTÉSIMAS (enteros). La escala tiene
 * valores de 0,75 y 0,8, y sumar floats en JavaScript da 4.499999999999999.
 * Se divide entre 100 una sola vez, al final.
 */

/* ------------------------------------------------------------------ */
/* Escala                                                              */
/* ------------------------------------------------------------------ */

/** Versión de la escala. Se guarda junto a cada lead: un score de 7,5 no
 *  significa lo mismo si mañana se repesa un criterio. Cuando la escala pase a
 *  `bant_config` en Supabase, esta constante deja de ser la fuente y pasa a ser
 *  la semilla de la v1. */
export const VERSION_ESCALA_BANT = "v1";

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
  /** Puntos × 100. */
  puntosX100: number;
};

export type PreguntaBant = {
  id: CriterioBant;
  /** Bloque BANT al que pertenece, para agrupar en pantalla. */
  bloque: "Budget" | "Authority" | "Need" | "Timeline";
  /** Etiqueta corta del desplegable. */
  etiqueta: string;
  /** Cómo se le pregunta al cliente en voz alta. El comercial está delante del
   *  lead, no rellenando una ficha. */
  guion: string;
  opciones: OpcionBant[];
};

export const PREGUNTAS_BANT: PreguntaBant[] = [
  {
    id: "budget_tiene",
    bloque: "Budget",
    etiqueta: "¿Tiene presupuesto?",
    guion: "¿Tenéis ya una partida asignada para esto, o es algo que todavía hay que aprobar?",
    opciones: [
      { valor: "si", etiquetaGhl: "Sí", puntosX100: 200 },
      { valor: "en_evaluacion", etiquetaGhl: "En evaluación", puntosX100: 100 },
      { valor: "no", etiquetaGhl: "No", puntosX100: 0 },
    ],
  },
  {
    id: "budget_rango",
    bloque: "Budget",
    etiqueta: "Rango de inversión",
    guion: "¿En qué orden de magnitud os habéis planteado la inversión?",
    opciones: [
      { valor: "mas_50k", etiquetaGhl: "Más de 50K", puntosX100: 200 },
      { valor: "15_50k", etiquetaGhl: "Entre 15 y 50K", puntosX100: 150 },
      { valor: "5_15k", etiquetaGhl: "Entre 5 y 15K", puntosX100: 100 },
      { valor: "menos_5k", etiquetaGhl: "Menos de 5K", puntosX100: 50 },
    ],
  },
  {
    id: "authority",
    bloque: "Authority",
    etiqueta: "¿Es el decisor?",
    guion: "¿Esta decisión la firmas tú, o hay alguien más que tenga que dar el visto bueno?",
    opciones: [
      { valor: "si", etiquetaGhl: "Sí", puntosX100: 200 },
      { valor: "con_otros", etiquetaGhl: "Decide con otros", puntosX100: 100 },
      { valor: "no", etiquetaGhl: "No", puntosX100: 0 },
    ],
  },
  {
    id: "need_urgencia",
    bloque: "Need",
    etiqueta: "Nivel de urgencia (1-5)",
    guion: "Del 1 al 5, ¿cuánto te corre resolver esto?",
    opciones: [
      { valor: "5", etiquetaGhl: "5", puntosX100: 100 },
      { valor: "4", etiquetaGhl: "4", puntosX100: 80 },
      { valor: "3", etiquetaGhl: "3", puntosX100: 60 },
      { valor: "2", etiquetaGhl: "2", puntosX100: 40 },
      { valor: "1", etiquetaGhl: "1", puntosX100: 20 },
    ],
  },
  {
    id: "need_impacto",
    bloque: "Need",
    etiqueta: "Impacto estimado",
    guion:
      "Si esto siguiera igual dentro de un año, ¿qué os costaría? ¿Es un incordio o os frena de verdad?",
    opciones: [
      { valor: "critico", etiquetaGhl: "Crítico", puntosX100: 100 },
      { valor: "alto", etiquetaGhl: "Alto", puntosX100: 75 },
      { valor: "medio", etiquetaGhl: "Medio", puntosX100: 50 },
      { valor: "bajo", etiquetaGhl: "Bajo", puntosX100: 25 },
    ],
  },
  {
    id: "timeline",
    bloque: "Timeline",
    etiqueta: "Plazo",
    guion: "¿Para cuándo necesitaríais tenerlo funcionando?",
    opciones: [
      { valor: "menos_1_mes", etiquetaGhl: "Menos de 1 mes", puntosX100: 200 },
      { valor: "1_3_meses", etiquetaGhl: "Entre 1 y 3 meses", puntosX100: 150 },
      { valor: "mas_3_meses", etiquetaGhl: "Más de 3 meses", puntosX100: 75 },
      { valor: "sin_plazo", etiquetaGhl: "Sin plazo", puntosX100: 0 },
    ],
  },
];

/** Máximo de cada criterio, derivado de sus propias opciones. Antes se declaraba
 *  a mano junto a la pregunta y eran dos fuentes para el mismo dato: si alguien
 *  cambiaba un peso y olvidaba el máximo, el techo mentía en silencio. */
export function maximoX100(pregunta: PreguntaBant): number {
  return Math.max(...pregunta.opciones.map((o) => o.puntosX100));
}

/** El total tiene que seguir siendo 0-10. Si alguien toca la escala, salta aquí
 *  y no tres capas más abajo con un score que ya no significa nada. */
export const MAXIMO_X100 = PREGUNTAS_BANT.reduce((s, p) => s + maximoX100(p), 0);
if (MAXIMO_X100 !== 1000) {
  throw new Error(`La escala BANT suma ${MAXIMO_X100 / 100}, tiene que sumar 10.`);
}

/** Centésimas a puntos, redondeando a un decimal (sección 4.2). */
const aPuntos = (x100: number) => Math.round(x100 / 10) / 10;

/* ------------------------------------------------------------------ */
/* Cálculo                                                             */
/* ------------------------------------------------------------------ */

/** Parcial a propósito: en la captación el comercial responde lo que haya
 *  salido en la conversación. Lo que falte se completa en el diagnóstico. */
export type RespuestasBant = Partial<Record<CriterioBant, string>>;

export const CLASIFICACIONES = ["hot", "warm", "cold"] as const;
export type Clasificacion = (typeof CLASIFICACIONES)[number];

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

/** Cortes de la sección 4.2: 8-10 HOT · 5-7,9 WARM · 0-4,9 COLD. */
export function clasificar(total: number): Clasificacion {
  if (total >= 8) return "hot";
  if (total >= 5) return "warm";
  return "cold";
}

export type ResultadoBant = {
  /** 0-10, con un decimal. Es lo que se escribe en GHL. */
  total: number;
  clasificacion: Clasificacion;
  respondidas: number;
  /** Las seis contestadas. Mientras sea false, el score es provisional. */
  completo: boolean;
  /** Máximo alcanzable con lo que aún está sin responder. Sirve para no
   *  enfriar un lead que en realidad está a medio cualificar. */
  techo: number;
  sinResponder: CriterioBant[];
  /** Escala con la que se calculó este resultado. */
  version: string;
};

export function calcularBant(r: RespuestasBant): ResultadoBant {
  let obtenidosX100 = 0;
  let pendientesX100 = 0;
  const sinResponder: CriterioBant[] = [];

  for (const pregunta of PREGUNTAS_BANT) {
    const valor = r[pregunta.id];
    const opcion = pregunta.opciones.find((o) => o.valor === valor);
    if (opcion) {
      obtenidosX100 += opcion.puntosX100;
    } else {
      pendientesX100 += maximoX100(pregunta);
      sinResponder.push(pregunta.id);
    }
  }

  const total = aPuntos(obtenidosX100);
  return {
    total,
    clasificacion: clasificar(total),
    respondidas: PREGUNTAS_BANT.length - sinResponder.length,
    completo: sinResponder.length === 0,
    techo: aPuntos(obtenidosX100 + pendientesX100),
    sinResponder,
    version: VERSION_ESCALA_BANT,
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
  return opcion ? aPuntos(opcion.puntosX100) : undefined;
}