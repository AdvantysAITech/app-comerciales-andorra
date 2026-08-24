/**
 * Árbol de clasificación T1–T4 y mapa de las siete rutas.
 * Especificación: APP_COMERCIAL_ADVANTYS_DEFINITIVO.md, sección 3.
 *
 * TypeScript puro: ni Next ni GHL.
 *
 * La línea de negocio deja de ser una ENTRADA del formulario y pasa a ser una
 * CONSECUENCIA de la ruta. El comercial ya no elige "Consultoría / JV / ISO":
 * responde dos, tres o cuatro preguntas de negocio y la ruta sale sola. Es el
 * cambio de fondo respecto a RF-16 del DERCAS.
 */

import type { LineaNegocio, RolJV } from "./tipos";
import type { Servicio } from "./servicio";

/* ------------------------------------------------------------------ */
/* Las siete rutas                                                     */
/* ------------------------------------------------------------------ */

export const RUTAS = [
  "ruta_1",
  "ruta_2",
  "ruta_3",
  "ruta_4",
  "ruta_5",
  "ruta_6",
  "ruta_7",
] as const;
export type Ruta = (typeof RUTAS)[number];

/** Texto EXACTO de las opciones del campo "Ruta" en GHL. Constantes de
 *  máquina, no texto de cara al comercial: lo que él lee es `nombre`. */
export const ETIQUETA_RUTA: Record<Ruta, string> = {
  ruta_1: "RUTA_1",
  ruta_2: "RUTA_2",
  ruta_3: "RUTA_3",
  ruta_4: "RUTA_4",
  ruta_5: "RUTA_5",
  ruta_6: "RUTA_6",
  ruta_7: "RUTA_7",
};

export type DefinicionRuta = {
  /** Lo que ve el comercial en pantalla. */
  nombre: string;
  linea: LineaNegocio;
  servicio?: Servicio;
  rolJV?: RolJV;
  /** false = la app no da precio en la reunión (rutas 4, 6 y 7). */
  calculaPrecio: boolean;
  /** Aviso que se muestra en pantalla antes de seguir. Sección 5. */
  aviso?: string;
};

/**
 * Mapa de la sección 3. Cada ruta determina por completo dónde acaba el lead
 * en GHL: pipeline, línea, servicio y rol. El pipeline no se declara aquí —
 * lo resuelve `pipelineDestino()` en lib/ghl/ids.ts a partir de línea y rol,
 * y así sigue habiendo una sola fuente de verdad para los IDs.
 */
export const DEFINICION_RUTA: Record<Ruta, DefinicionRuta> = {
  ruta_1: {
    nombre: "Consultoría Sistema Advantys",
    linea: "consultoria",
    servicio: "consultoria_sistema",
    calculaPrecio: true,
  },
  ruta_2: {
    nombre: "Consultoría IA AdHoc",
    linea: "consultoria",
    servicio: "consultoria_adhoc",
    calculaPrecio: true,
  },
  ruta_3: {
    nombre: "Implantación Sistema Advantys",
    linea: "consultoria",
    servicio: "implantacion_sistema",
    calculaPrecio: true,
  },
  ruta_4: {
    nombre: "Implantación Proyecto AdHoc",
    linea: "consultoria",
    servicio: "implantacion_adhoc",
    calculaPrecio: false,
    aviso:
      "Este servicio no tiene precio inmediato. El presupuesto lo elabora el " +
      "equipo técnico y se envía en un plazo de 5 días laborables. No comprometas " +
      "cifras con el cliente.",
  },
  ruta_5: {
    nombre: "Consultoría ISO 42001",
    linea: "iso42001",
    servicio: "consultoria_iso",
    calculaPrecio: true,
    aviso:
      "Servicio en reserva. La ejecución comienza en enero de 2027. El importe " +
      "es una horquilla orientativa sujeta a validación de Jacob.",
  },
  ruta_6: {
    nombre: "Spin-off · Cliente Final",
    linea: "jv_builder",
    rolJV: "cliente_final",
    servicio: "implantacion_sistema",
    calculaPrecio: false,
    aviso:
      "Sin precio. El objetivo de esta conversación es una carta de intenciones, " +
      "no un presupuesto.",
  },
  ruta_7: {
    nombre: "Spin-off · Inversor",
    linea: "jv_builder",
    rolJV: "inversor",
    calculaPrecio: false,
  },
};

/** Las rutas de spin-off exigen elegir la spin-off (R6.1 / R7.1). */
export const requiereSpinoff = (ruta: Ruta) =>
  DEFINICION_RUTA[ruta].linea === "jv_builder";

/* ------------------------------------------------------------------ */
/* El árbol T1–T4                                                      */
/* ------------------------------------------------------------------ */

export const NODOS = ["T1", "T2", "T3", "T4"] as const;
export type NodoId = (typeof NODOS)[number];

/** Adónde lleva una opción: a otra pregunta, o directamente a una ruta. */
export type Destino =
  | { tipo: "nodo"; nodo: NodoId }
  | { tipo: "ruta"; ruta: Ruta };

export type OpcionNodo = {
  valor: string;
  etiqueta: string;
  /** Aclaración corta bajo la opción, cuando el enunciado no basta. */
  ayuda?: string;
  destino: Destino;
};

export type Nodo = {
  id: NodoId;
  pregunta: string;
  opciones: OpcionNodo[];
};

const nodo = (n: NodoId): Destino => ({ tipo: "nodo", nodo: n });
const ruta = (r: Ruta): Destino => ({ tipo: "ruta", ruta: r });

export const ARBOL: Record<NodoId, Nodo> = {
  T1: {
    id: "T1",
    pregunta: "¿Qué busca este contacto?",
    opciones: [
      {
        valor: "propia_empresa",
        etiqueta: "Resolver un problema o mejorar procesos en su propia empresa",
        destino: nodo("T2"),
      },
      {
        valor: "invertir",
        etiqueta: "Invertir en una empresa de Advantys",
        destino: ruta("ruta_7"),
      },
      {
        valor: "solucion_vertical",
        etiqueta: "Implantar en su organización una de nuestras soluciones verticales",
        ayuda: "Educación, Agro, Residencia u Hospitality",
        destino: ruta("ruta_6"),
      },
      {
        valor: "iso",
        etiqueta: "Certificarse en ISO 42001",
        destino: ruta("ruta_5"),
      },
    ],
  },

  T2: {
    id: "T2",
    pregunta: "¿Qué ámbito quiere cubrir?",
    opciones: [
      {
        valor: "ciclo_comercial",
        etiqueta: "Marketing, venta, posventa o gestión",
        ayuda: "El ciclo comercial completo o una parte",
        destino: nodo("T3"),
      },
      {
        valor: "proceso_concreto",
        etiqueta: "Un proceso concreto, técnico o de operaciones, con IA",
        destino: nodo("T4"),
      },
    ],
  },

  T3: {
    id: "T3",
    pregunta: "Sistema Advantys: ¿tiene claro lo que quiere?",
    opciones: [
      {
        valor: "sabe_modulos",
        etiqueta: "Sí, sabe qué módulos necesita",
        destino: ruta("ruta_3"),
      },
      {
        valor: "hay_que_analizar",
        etiqueta: "No, hay que analizarlo antes",
        destino: ruta("ruta_1"),
      },
    ],
  },

  T4: {
    id: "T4",
    pregunta: "Proyecto AdHoc: ¿trae documentación?",
    opciones: [
      {
        valor: "con_documentacion",
        etiqueta: "Sí: RFP, pliego o especificación escrita",
        destino: ruta("ruta_4"),
      },
      {
        valor: "sin_documentacion",
        etiqueta: "No, o incompleta",
        destino: ruta("ruta_2"),
      },
    ],
  },
};

export const NODO_RAIZ: NodoId = "T1";

/* ------------------------------------------------------------------ */
/* Recorrido                                                           */
/* ------------------------------------------------------------------ */

/** Las respuestas dadas hasta ahora, por nodo. */
export type RespuestasArbol = Partial<Record<NodoId, string>>;

export type EstadoArbol =
  | { estado: "preguntando"; nodo: Nodo; camino: NodoId[] }
  | { estado: "resuelto"; ruta: Ruta; camino: NodoId[] };

/**
 * Recorre el árbol con las respuestas dadas y dice dónde está el comercial:
 * o en una pregunta pendiente, o en una ruta ya determinada.
 *
 * Devuelve también el CAMINO recorrido, y no por adorno: es lo que permite a
 * la pantalla dibujar las migas de pan y, sobre todo, descartar las respuestas
 * que dejan de tener sentido cuando alguien cambia una decisión anterior.
 * Sin eso, cambiar T1 de "su propia empresa" a "invertir" dejaría colgada una
 * respuesta de T3 que ya no pinta nada.
 */
export function recorrer(respuestas: RespuestasArbol): EstadoArbol {
  const camino: NodoId[] = [];
  let actual: NodoId = NODO_RAIZ;

  // Tope de seguridad: el árbol tiene cuatro nodos y ningún ciclo, pero si
  // alguien introduce uno al editar ARBOL, esto falla rápido en vez de colgar
  // el navegador del comercial.
  for (let i = 0; i <= NODOS.length; i++) {
    camino.push(actual);
    const nodoActual = ARBOL[actual];
    const respuesta = respuestas[actual];
    const opcion = nodoActual.opciones.find((o) => o.valor === respuesta);

    if (!opcion) return { estado: "preguntando", nodo: nodoActual, camino };
    if (opcion.destino.tipo === "ruta") {
      return { estado: "resuelto", ruta: opcion.destino.ruta, camino };
    }
    actual = opcion.destino.nodo;
  }

  throw new Error("El árbol de clasificación tiene un ciclo. Revisa ARBOL.");
}

/** Limpia las respuestas que ya no están en el camino vigente. */
export function podar(respuestas: RespuestasArbol): RespuestasArbol {
  const { camino } = recorrer(respuestas);
  const vivas: RespuestasArbol = {};
  for (const n of camino) if (respuestas[n]) vivas[n] = respuestas[n];
  return vivas;
}