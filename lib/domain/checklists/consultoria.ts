/** Checklists de las dos rutas de consultoría. Sección 5 del documento. */

import type { Checklist } from "./tipos";

/** Se repite en varias rutas con el mismo enunciado y las mismas opciones. */
const NIVEL_DOCUMENTAL = [
  { valor: "todo", etiqueta: "Todo documentado y actualizado" },
  { valor: "parcial", etiqueta: "Parcial o desactualizado" },
  { valor: "nada", etiqueta: "Nada documentado" },
];

const PERSONAS_ENTREVISTAR = [
  { valor: "1_3", etiqueta: "1-3" },
  { valor: "4_8", etiqueta: "4-8" },
  { valor: "9_15", etiqueta: "9-15" },
  { valor: "mas_15", etiqueta: "Más de 15" },
];

const MODALIDAD_SESIONES = [
  { valor: "online", etiqueta: "Todo online" },
  { valor: "mixto", etiqueta: "Mixto" },
  { valor: "presencial", etiqueta: "Todo presencial" },
];

/* ================================================================== */
/* RUTA 1 · Consultoría Sistema Advantys                               */
/* ================================================================== */

export const CHECKLIST_RUTA_1: Checklist = {
  ruta: "ruta_1",
  contexto: "R1.6",
  intro:
    "Analiza qué necesita el cliente y qué módulos aplican. Se descuenta " +
    "íntegra si contrata la implantación en los 60 días siguientes.",
  preguntas: [
    {
      id: "R1.1",
      tipo: "multi_seleccion",
      enunciado: "¿Qué áreas hay que analizar?",
      obligatorio: true,
      minimo: 1,
      opciones: [
        { valor: "marketing", etiqueta: "Marketing" },
        { valor: "venta", etiqueta: "Venta" },
        { valor: "posventa", etiqueta: "Posventa" },
        { valor: "gestion", etiqueta: "Gestión" },
      ],
    },
    {
      id: "R1.2",
      tipo: "seleccion_unica",
      enunciado: "¿Cuántas personas hay que entrevistar?",
      obligatorio: true,
      opciones: PERSONAS_ENTREVISTAR,
    },
    {
      id: "R1.3",
      tipo: "seleccion_unica",
      enunciado: "¿Tiene documentados sus procesos actuales?",
      obligatorio: true,
      opciones: NIVEL_DOCUMENTAL,
    },
    {
      id: "R1.4",
      tipo: "seleccion_unica",
      enunciado: "¿Qué tiene montado hoy?",
      obligatorio: true,
      opciones: [
        { valor: "nada", etiqueta: "Nada, empieza de cero" },
        { valor: "sueltas", etiqueta: "Herramientas sueltas sin conectar" },
        { valor: "crm_migrar", etiqueta: "Un CRM que hay que migrar" },
        { valor: "sistema_sustituir", etiqueta: "Un sistema completo que hay que sustituir" },
      ],
    },
    {
      id: "R1.5",
      tipo: "seleccion_unica",
      enunciado: "Modalidad de las sesiones",
      obligatorio: true,
      opciones: MODALIDAD_SESIONES,
    },
    {
      // El documento define el precio como "450 € × jornadas presenciales",
      // pero la pregunta de arriba solo devuelve una categoría. Sin un número
      // ese sumando no se puede calcular, así que se pregunta. Decisión de
      // Jacob del 24/08: lo pone el comercial, no una tabla de equivalencias.
      id: "R1.5a",
      tipo: "numero",
      enunciado: "¿Cuántas jornadas presenciales?",
      obligatorio: true,
      min: 1,
      max: 30,
      unidad: "jornadas",
      condicion: { pregunta: "R1.5", incluye: ["mixto", "presencial"] },
    },
    {
      id: "R1.5b",
      tipo: "texto",
      enunciado: "¿En qué ciudad?",
      obligatorio: true,
      condicion: { pregunta: "R1.5", incluye: ["mixto", "presencial"] },
    },
    {
      // Único campo de audio de la ruta (decisión de Jacob, 24/08: "solo el
      // último"). Si mañana se quiere audio en más campos, es cambiar el tipo.
      id: "R1.6",
      tipo: "audio",
      enunciado: "Contexto del cliente",
      ayuda: "Qué problema le duele, qué ha intentado antes, qué espera conseguir.",
      obligatorio: true,
    },
  ],
};

/* ================================================================== */
/* RUTA 2 · Consultoría IA AdHoc                                       */
/* ================================================================== */

export const CHECKLIST_RUTA_2: Checklist = {
  ruta: "ruta_2",
  contexto: "R2.10",
  intro: "Se cotiza por departamentos y procesos.",
  preguntas: [
    {
      id: "R2.1",
      tipo: "multi_seleccion",
      enunciado: "¿Qué departamentos entran en el análisis?",
      obligatorio: true,
      minimo: 1,
      opciones: [
        { valor: "direccion", etiqueta: "Dirección" },
        { valor: "marketing", etiqueta: "Marketing" },
        { valor: "ventas", etiqueta: "Ventas" },
        { valor: "operaciones", etiqueta: "Operaciones / Producción" },
        { valor: "atencion_cliente", etiqueta: "Atención al cliente" },
        { valor: "administracion", etiqueta: "Administración y Finanzas" },
        { valor: "rrhh", etiqueta: "RRHH" },
        { valor: "compras", etiqueta: "Compras y Logística" },
        { valor: "it", etiqueta: "IT" },
      ],
    },
    {
      // Una fila por departamento marcado arriba. La app suma el total de
      // procesos en servidor; el comercial no ve ninguna cifra intermedia.
      id: "R2.2",
      tipo: "por_cada",
      fuente: "R2.1",
      enunciado: "Por cada departamento: ¿cuántos procesos hay que analizar?",
      obligatorio: true,
      opciones: [
        { valor: "1_2", etiqueta: "1-2" },
        { valor: "3_5", etiqueta: "3-5" },
        { valor: "6_10", etiqueta: "6-10" },
        { valor: "mas_10", etiqueta: "Más de 10" },
      ],
    },
    {
      id: "R2.3",
      tipo: "seleccion_unica",
      enunciado: "¿Qué nivel documental tiene el cliente?",
      obligatorio: true,
      opciones: NIVEL_DOCUMENTAL,
    },
    {
      id: "R2.4",
      tipo: "seleccion_unica",
      enunciado: "¿Cuántas personas hay que entrevistar?",
      obligatorio: true,
      opciones: PERSONAS_ENTREVISTAR,
    },
    {
      id: "R2.5",
      tipo: "seleccion_unica",
      enunciado: "¿Hay sistemas heredados que condicionen la solución?",
      obligatorio: true,
      opciones: [
        { valor: "no", etiqueta: "No" },
        { valor: "uno_dos", etiqueta: "Sí, uno o dos" },
        { valor: "complejo", etiqueta: "Sí, un entorno complejo" },
      ],
    },
    {
      id: "R2.6",
      tipo: "seleccion_unica",
      enunciado: "¿Hay requisitos normativos o datos sensibles?",
      obligatorio: true,
      opciones: [
        { valor: "no", etiqueta: "No" },
        { valor: "estandar", etiqueta: "Protección de datos estándar" },
        {
          valor: "sensibles",
          etiqueta: "Datos sensibles",
          ayuda: "Salud, menores, biometría o financieros",
        },
        { valor: "regulado", etiqueta: "Sector regulado" },
      ],
    },
    {
      id: "R2.7",
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
      id: "R2.8",
      tipo: "seleccion_unica",
      enunciado:
        "¿El resultado debe llegar a especificación técnica para poder " +
        "presupuestar el desarrollo?",
      obligatorio: true,
      opciones: [
        { valor: "si", etiqueta: "Sí" },
        { valor: "no", etiqueta: "No, basta diagnóstico y hoja de ruta" },
      ],
    },
    {
      id: "R2.9",
      tipo: "seleccion_unica",
      enunciado: "Modalidad de las sesiones",
      obligatorio: true,
      opciones: MODALIDAD_SESIONES,
    },
    {
      id: "R2.9a",
      tipo: "numero",
      enunciado: "¿Cuántas jornadas presenciales?",
      obligatorio: true,
      min: 1,
      max: 30,
      unidad: "jornadas",
      condicion: { pregunta: "R2.9", incluye: ["mixto", "presencial"] },
    },
    {
      id: "R2.9b",
      tipo: "texto",
      enunciado: "¿En qué ciudad?",
      obligatorio: true,
      condicion: { pregunta: "R2.9", incluye: ["mixto", "presencial"] },
    },
    {
      id: "R2.10",
      tipo: "audio",
      enunciado: "Contexto del cliente",
      ayuda: "Qué problema le duele, qué ha intentado antes, qué espera conseguir.",
      obligatorio: true,
    },
  ],
};