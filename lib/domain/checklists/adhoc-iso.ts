/** RUTA 4 · Implantación Proyecto AdHoc y RUTA 5 · Consultoría ISO 42001. */

import type { Checklist } from "./tipos";

/* ================================================================== */
/* RUTA 4 · Implantación Proyecto AdHoc                                */
/* ================================================================== */

export const CHECKLIST_RUTA_4: Checklist = {
  ruta: "ruta_4",
  contexto: "R4.7",
  intro:
    "Este servicio no tiene precio inmediato. El presupuesto lo elabora el " +
    "equipo técnico y se envía en 5 días laborables. No comprometas cifras " +
    "con el cliente.",
  preguntas: [
    {
      id: "R4.1",
      tipo: "seleccion_unica",
      enunciado: "¿Qué documentación aporta el cliente?",
      obligatorio: true,
      opciones: [
        { valor: "rfp", etiqueta: "RFP o pliego formal" },
        { valor: "especificacion", etiqueta: "Especificación funcional propia" },
        { valor: "informal", etiqueta: "Documento informal o correo" },
        {
          valor: "nada",
          etiqueta: "Nada",
          ayuda: "Sin documento no hay proyecto que presupuestar: pasa a Consultoría IA AdHoc.",
        },
      ],
      // Sin documentación no hay alcance que trasladar a la subcontrata: hay
      // una consultoría que vender. El lead cambia de ruta solo, sin que el
      // comercial tenga que volver atrás y rehacer la clasificación.
      reencamina: { nada: "ruta_2" },
    },
    {
      id: "R4.2",
      tipo: "fichero",
      enunciado: "Adjunta la documentación",
      obligatorio: true,
      formatos: [".pdf", ".docx", ".xlsx"],
      condicion: { pregunta: "R4.1", incluye: ["rfp", "especificacion", "informal"] },
    },
    {
      id: "R4.3",
      tipo: "seleccion_unica",
      enunciado: "¿Qué tipo de solución pide?",
      obligatorio: true,
      opciones: [
        { valor: "automatizacion", etiqueta: "Automatización de procesos" },
        { valor: "agente_ia", etiqueta: "Agente o bot con IA" },
        { valor: "app_medida", etiqueta: "Aplicación a medida" },
        { valor: "integracion", etiqueta: "Integración entre sistemas" },
        { valor: "datos", etiqueta: "Análisis de datos y dashboards" },
        { valor: "otro", etiqueta: "Otro" },
      ],
    },
    {
      id: "R4.4",
      tipo: "seleccion_unica",
      enunciado: "¿Hay plazo comprometido o licitación con fecha?",
      obligatorio: true,
      opciones: [
        { valor: "no", etiqueta: "No" },
        { valor: "si", etiqueta: "Sí" },
      ],
    },
    {
      id: "R4.4a",
      tipo: "fecha",
      enunciado: "¿Qué fecha?",
      obligatorio: true,
      condicion: { pregunta: "R4.4", incluye: ["si"] },
    },
    {
      id: "R4.5",
      tipo: "seleccion_unica",
      enunciado: "¿Quién será el interlocutor técnico del cliente?",
      obligatorio: true,
      opciones: [
        { valor: "equipo_it", etiqueta: "Tiene equipo IT propio" },
        { valor: "una_persona", etiqueta: "Una persona técnica" },
        { valor: "nadie", etiqueta: "Nadie técnico" },
      ],
    },
    {
      id: "R4.6",
      tipo: "seleccion_unica",
      enunciado: "¿Ha dado alguna referencia de presupuesto?",
      obligatorio: true,
      opciones: [
        { valor: "no", etiqueta: "No" },
        { valor: "si", etiqueta: "Sí" },
      ],
    },
    {
      id: "R4.6a",
      tipo: "texto",
      enunciado: "¿Qué importe o rango ha mencionado?",
      obligatorio: true,
      condicion: { pregunta: "R4.6", incluye: ["si"] },
    },
    {
      id: "R4.7",
      tipo: "audio",
      enunciado: "Contexto y expectativas",
      ayuda:
        "Qué pide el cliente, qué ha dejado claro en la reunión y qué ha " +
        "quedado abierto.",
      obligatorio: true,
    },
  ],
};

/* ================================================================== */
/* RUTA 5 · Consultoría ISO 42001                                      */
/* ================================================================== */

/**
 * Los nueve factores de complejidad de la sección 6.6.
 *
 * ⚠ Aquí están las OPCIONES, no los puntos. La tabla del documento asigna a
 * cada opción un valor entre −4 y +9, y esos números son el modelo de
 * estimación de Advantys: no viajan al navegador. Viven en lib/precios/iso.ts,
 * indexados por estas mismas claves.
 *
 * I5, I6 e I7 restan puntos, y la sección 6.6 avisa de que NO se presentan al
 * cliente como descuento. Otra razón para que el comercial no vea el peso: si
 * lo viera, acabaría usándolo como argumento de precio.
 */
export const CHECKLIST_RUTA_5: Checklist = {
  ruta: "ruta_5",
  contexto: "R5.4",
  intro:
    "Servicio en reserva: la ejecución comienza en enero de 2027. El importe " +
    "es una horquilla orientativa sujeta a validación de Jacob. La tasa del " +
    "organismo certificador NO está incluida y ronda los 6.000-12.000 €.",
  preguntas: [
    {
      // No se deduce del nº de empleados del contacto: los tramos no coinciden
      // (GHL usa 1-10/11-50/51-100/101-200/+200, aquí ≤25/26-100/101-250/>250).
      id: "I1",
      tipo: "seleccion_unica",
      enunciado: "Tamaño de la empresa",
      obligatorio: true,
      opciones: [
        { valor: "hasta_25", etiqueta: "25 empleados o menos" },
        { valor: "26_100", etiqueta: "Entre 26 y 100" },
        { valor: "101_250", etiqueta: "Entre 101 y 250" },
        { valor: "mas_250", etiqueta: "Más de 250" },
      ],
    },
    {
      id: "I2",
      tipo: "seleccion_unica",
      enunciado: "¿Cuántos sistemas de IA entran en el alcance?",
      obligatorio: true,
      opciones: [
        { valor: "uno", etiqueta: "Uno" },
        { valor: "2_3", etiqueta: "Entre 2 y 3" },
        { valor: "4_6", etiqueta: "Entre 4 y 6" },
        { valor: "7_o_mas", etiqueta: "Siete o más" },
      ],
    },
    {
      id: "I3",
      tipo: "seleccion_unica",
      enunciado: "¿Qué relación tiene con la IA?",
      obligatorio: true,
      opciones: [
        { valor: "solo_terceros", etiqueta: "Solo usa IA de terceros" },
        { valor: "desarrolla", etiqueta: "Desarrolla IA propia" },
        { valor: "ambas", etiqueta: "Ambas" },
      ],
    },
    {
      id: "I4",
      tipo: "seleccion_unica",
      enunciado: "Riesgo de los casos de uso",
      obligatorio: true,
      opciones: [
        { valor: "bajo", etiqueta: "Bajo", ayuda: "Procesos internos" },
        { valor: "medio", etiqueta: "Medio" },
        { valor: "alto", etiqueta: "Alto", ayuda: "Afecta a personas" },
      ],
    },
    {
      id: "I5",
      tipo: "seleccion_unica",
      enunciado: "¿Tiene certificaciones ISO previas?",
      obligatorio: true,
      opciones: [
        { valor: "iso27001", etiqueta: "Tiene ISO 27001" },
        { valor: "otra", etiqueta: "Solo 9001 u otra" },
        { valor: "ninguna", etiqueta: "Ninguna" },
      ],
    },
    {
      id: "I6",
      tipo: "seleccion_unica",
      enunciado: "Autodiagnóstico de la web",
      obligatorio: true,
      opciones: [
        { valor: "mas_60", etiqueta: "Más de 60 puntos" },
        { valor: "35_60", etiqueta: "Entre 35 y 60" },
        { valor: "menos_35", etiqueta: "Menos de 35" },
        { valor: "no_lo_hizo", etiqueta: "No lo hizo" },
      ],
    },
    {
      id: "I7",
      tipo: "seleccion_unica",
      enunciado: "Implicación del cliente",
      obligatorio: true,
      opciones: [
        { valor: "equipo_dedicado", etiqueta: "Equipo interno dedicado" },
        { valor: "una_persona", etiqueta: "Una persona a tiempo parcial" },
        { valor: "hazlo_tu", etiqueta: "«Hazlo todo tú»" },
      ],
    },
    {
      id: "I8",
      tipo: "seleccion_unica",
      enunciado: "Sedes y ámbito",
      obligatorio: true,
      opciones: [
        { valor: "una_sede", etiqueta: "Una sede" },
        { valor: "nacional", etiqueta: "Varias nacionales" },
        { valor: "internacional", etiqueta: "Internacional" },
      ],
    },
    {
      id: "I9",
      tipo: "seleccion_unica",
      enunciado: "¿Para cuándo lo necesita?",
      obligatorio: true,
      opciones: [
        { valor: "normal", etiqueta: "Plazo normal", ayuda: "Entre 6 y 9 meses" },
        { valor: "urgente", etiqueta: "Urgente", ayuda: "Menos de 6 meses" },
      ],
    },
    {
      id: "R5.extras",
      tipo: "multi_seleccion",
      enunciado: "Servicios adicionales",
      ayuda: "Ninguno si el cliente no los ha pedido.",
      obligatorio: false,
      opciones: [
        { valor: "auditoria_interna", etiqueta: "Auditoría interna previa a certificación" },
        { valor: "acompanamiento", etiqueta: "Acompañamiento en la auditoría de certificación" },
        { valor: "formacion", etiqueta: "Formación al personal en uso responsable de IA" },
      ],
    },

    /* Preguntas de contexto: van al documento, no al cálculo. */

    {
      id: "R5.1",
      tipo: "seleccion_unica",
      enunciado: "¿Qué le motiva certificarse?",
      obligatorio: true,
      opciones: [
        { valor: "cliente", etiqueta: "Lo exige un cliente" },
        { valor: "licitacion", etiqueta: "Licitación pública" },
        { valor: "ai_act", etiqueta: "Preparación ante el AI Act" },
        { valor: "diferenciacion", etiqueta: "Diferenciación comercial" },
        { valor: "conviccion", etiqueta: "Convicción interna" },
      ],
    },
    {
      id: "R5.2",
      tipo: "texto_largo",
      enunciado: "¿Qué sistemas de IA usa hoy?",
      ayuda: "Enumera cada sistema y para qué lo usa.",
      obligatorio: true,
    },
    {
      id: "R5.3",
      tipo: "seleccion_unica",
      enunciado: "¿Ha hablado ya con alguna certificadora?",
      obligatorio: true,
      opciones: [
        { valor: "no", etiqueta: "No" },
        { valor: "si", etiqueta: "Sí" },
      ],
    },
    {
      id: "R5.3a",
      tipo: "texto",
      enunciado: "¿Con cuál?",
      obligatorio: true,
      condicion: { pregunta: "R5.3", incluye: ["si"] },
    },
    {
      id: "R5.4",
      tipo: "audio",
      enunciado: "Contexto del cliente",
      obligatorio: true,
    },
  ],
};