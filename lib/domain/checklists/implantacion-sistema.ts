/**
 * RUTA 3 · Implantación Sistema Advantys. Sección 5 del documento definitivo.
 *
 * ⚠ El catálogo de módulos vive aquí SIN PRECIO Y SIN HORAS, solo con su
 * código y su nombre. Las dos columnas numéricas de la tabla del documento
 * —precio de venta y horas internas— están en lib/precios/, que es server-only.
 * La sección 8 es explícita: el comercial no ve horas. Este fichero lo importa
 * un componente cliente y viaja entero al navegador.
 *
 * Los CÓDIGOS (M01, V01, X01…) son la clave estable que une ambos lados.
 */

import type { Checklist, OpcionPregunta } from "./tipos";
import { MAYOR_QUE_CERO } from "./tipos";

/* ------------------------------------------------------------------ */
/* Catálogo de módulos                                                 */
/* ------------------------------------------------------------------ */

export const MODULOS_SISTEMA: OpcionPregunta[] = [
  { valor: "M01", etiqueta: "Web corporativa y landings", grupo: "Marketing" },
  { valor: "M02", etiqueta: "Embudos de captación", grupo: "Marketing" },
  { valor: "M03", etiqueta: "Formularios y captura de leads", grupo: "Marketing" },
  { valor: "M04", etiqueta: "Campañas de email y SMS", grupo: "Marketing" },
  { valor: "M05", etiqueta: "Nurturing automatizado", grupo: "Marketing" },

  { valor: "V01", etiqueta: "CRM: pipelines, fases y automatizaciones", grupo: "Venta" },
  { valor: "V02", etiqueta: "Calendario y reserva de reuniones", grupo: "Venta" },
  { valor: "V03", etiqueta: "Propuestas y firma digital", grupo: "Venta" },
  { valor: "V04", etiqueta: "Dashboard comercial", grupo: "Venta" },

  { valor: "P01", etiqueta: "Bot de soporte con IA", grupo: "Posventa" },
  { valor: "P02", etiqueta: "Sistema de tickets", grupo: "Posventa" },
  { valor: "P03", etiqueta: "Base de conocimiento", grupo: "Posventa" },

  { valor: "G01", etiqueta: "Facturación (Holded)", grupo: "Gestión" },
  { valor: "G02", etiqueta: "Gestión de proyectos (Zoho Projects)", grupo: "Gestión" },
  { valor: "G03", etiqueta: "Dashboard de gestión", grupo: "Gestión" },

  {
    valor: "X01",
    etiqueta: "Aplicación a medida",
    ayuda: "Desarrollo real, sin snapshot. Abre un bloque de preguntas adicional.",
    grupo: "Módulo especial",
  },
];

/** Marcar X01 fuerza REVISION_OBLIGATORIA (sección 6.8). La comprobación se
 *  hace en servidor; esta constante existe para que el motor de precios y el
 *  checklist no se refieran al módulo especial con una cadena suelta. */
export const MODULO_APP_MEDIDA = "X01";

/* ------------------------------------------------------------------ */
/* Checklist                                                           */
/* ------------------------------------------------------------------ */

export const CHECKLIST_RUTA_3: Checklist = {
  ruta: "ruta_3",
  contexto: "R3.10",
  intro:
    "El cliente ya sabe qué necesita. Marca los módulos y los extras: el " +
    "precio sale del catálogo.",
  preguntas: [
    {
      id: "R3.1",
      tipo: "multi_seleccion",
      enunciado: "¿Qué módulos necesita?",
      obligatorio: true,
      minimo: 1,
      opciones: MODULOS_SISTEMA,
    },

    {
      // El documento pregunta por un rango ("3-5") pero cobra 1.200 € POR
      // integración, y un rango no se puede multiplicar. Decisión de Jacob del
      // 24/08: se cuenta lo que el comercial liste, y el rango se queda como
      // orientación en el texto de ayuda.
      id: "R3.2",
      tipo: "numero",
      enunciado: "¿Con cuántos sistemas externos hay que integrarse?",
      ayuda: "Cero si no hay ninguno. Lo habitual son entre 1 y 5.",
      obligatorio: true,
      min: 0,
      max: 30,
      unidad: "sistemas",
    },
    {
      id: "R3.2a",
      tipo: "texto",
      enunciado: "¿Cuáles?",
      ayuda: "ERP, contabilidad, web existente, pasarela de pago, otros.",
      obligatorio: true,
      condicion: { pregunta: "R3.2", incluye: [MAYOR_QUE_CERO] },
    },

    {
      id: "R3.3",
      tipo: "seleccion_unica",
      enunciado: "¿Tiene ya algo montado?",
      obligatorio: true,
      opciones: [
        { valor: "nada", etiqueta: "Nada, empieza de cero" },
        { valor: "sueltas", etiqueta: "Herramientas sueltas" },
        { valor: "crm_migrar", etiqueta: "Un CRM que hay que migrar" },
        { valor: "sistema_sustituir", etiqueta: "Un sistema completo que hay que sustituir" },
      ],
    },
    {
      id: "R3.4",
      tipo: "seleccion_unica",
      enunciado: "Volumen de datos a migrar",
      obligatorio: true,
      opciones: [
        { valor: "sin_migracion", etiqueta: "Sin migración" },
        { valor: "menos_1000", etiqueta: "Menos de 1.000 registros" },
        { valor: "1000_10000", etiqueta: "Entre 1.000 y 10.000" },
        { valor: "mas_10000", etiqueta: "Más de 10.000" },
      ],
    },
    {
      id: "R3.5",
      tipo: "seleccion_unica",
      enunciado: "Usuarios que van a usar el sistema",
      obligatorio: true,
      opciones: [
        { valor: "1_5", etiqueta: "1-5" },
        { valor: "6_20", etiqueta: "6-20" },
        { valor: "21_50", etiqueta: "21-50" },
        { valor: "mas_50", etiqueta: "Más de 50" },
      ],
    },
    {
      // "Tres o más" no sirve para multiplicar un 8% por idioma adicional.
      // Mismo criterio que en R3.2: número directo.
      id: "R3.6",
      tipo: "numero",
      enunciado: "¿En cuántos idiomas tiene que funcionar el sistema?",
      ayuda: "Uno si es monolingüe.",
      obligatorio: true,
      min: 1,
      max: 10,
      unidad: "idiomas",
    },
    {
      id: "R3.7",
      tipo: "seleccion_unica",
      enunciado: "Formación y acompañamiento",
      obligatorio: true,
      opciones: [
        { valor: "sin_formacion", etiqueta: "Sin formación" },
        { valor: "sesion_unica", etiqueta: "Sesión única" },
        { valor: "plan_por_rol", etiqueta: "Plan de formación por rol" },
        { valor: "acompanamiento_3m", etiqueta: "Acompañamiento continuado 3 meses" },
      ],
    },
    {
      id: "R3.8",
      tipo: "seleccion_unica",
      enunciado: "Plazo que pide el cliente",
      obligatorio: true,
      opciones: [
        { valor: "sin_prisa", etiqueta: "Sin prisa" },
        { valor: "3_meses_o_mas", etiqueta: "3 meses o más" },
        { valor: "2_meses", etiqueta: "2 meses" },
        {
          valor: "menos_2_meses",
          etiqueta: "Menos de 2 meses",
          ayuda: "Lleva recargo de urgencia.",
        },
      ],
    },

    /* ---------------------------------------------------------------- */
    /* R3.9 · Bloque de aplicación a medida (solo si marcó X01)          */
    /* ---------------------------------------------------------------- */

    {
      id: "R3.9a",
      tipo: "multi_seleccion",
      enunciado: "La aplicación a medida, ¿para quién es?",
      obligatorio: true,
      minimo: 1,
      opciones: [
        { valor: "tecnicos_campo", etiqueta: "Técnicos en campo" },
        { valor: "comerciales", etiqueta: "Comerciales" },
        { valor: "administracion", etiqueta: "Administración" },
        { valor: "clientes_finales", etiqueta: "Clientes finales" },
      ],
      condicion: { pregunta: "R3.1", incluye: [MODULO_APP_MEDIDA] },
    },
    {
      id: "R3.9b",
      tipo: "seleccion_unica",
      enunciado: "¿Necesita funcionar sin cobertura?",
      obligatorio: true,
      opciones: [
        { valor: "si", etiqueta: "Sí" },
        { valor: "no", etiqueta: "No" },
      ],
      condicion: { pregunta: "R3.1", incluye: [MODULO_APP_MEDIDA] },
    },
    {
      id: "R3.9c",
      tipo: "seleccion_unica",
      enunciado: "¿Dónde se usa?",
      obligatorio: true,
      opciones: [
        { valor: "movil", etiqueta: "Solo móvil" },
        { valor: "escritorio", etiqueta: "Solo escritorio" },
        { valor: "ambos", etiqueta: "Ambos" },
      ],
      condicion: { pregunta: "R3.1", incluye: [MODULO_APP_MEDIDA] },
    },
    {
      id: "R3.9d",
      tipo: "seleccion_unica",
      enunciado: "¿Genera documentos o informes?",
      obligatorio: true,
      opciones: [
        { valor: "si", etiqueta: "Sí" },
        { valor: "no", etiqueta: "No" },
      ],
      condicion: { pregunta: "R3.1", incluye: [MODULO_APP_MEDIDA] },
    },
    {
      id: "R3.9e",
      tipo: "seleccion_unica",
      enunciado: "¿Necesita firma o captura de fotos?",
      obligatorio: true,
      opciones: [
        { valor: "si", etiqueta: "Sí" },
        { valor: "no", etiqueta: "No" },
      ],
      condicion: { pregunta: "R3.1", incluye: [MODULO_APP_MEDIDA] },
    },
    {
      id: "R3.9f",
      tipo: "texto",
      enunciado: "¿Se conecta con algún sistema del cliente? ¿Cuál?",
      ayuda: "Déjalo vacío si no se conecta con ninguno.",
      obligatorio: false,
      condicion: { pregunta: "R3.1", incluye: [MODULO_APP_MEDIDA] },
    },
    {
      // El documento lo marca como audio obligatorio. Pasa a texto por la
      // decisión de Jacob del 24/08 (un solo campo de audio por ruta, el de
      // contexto). Es el campo que más alimenta la estimación de horas de la
      // IA, así que conviene que salga largo: de ahí el enunciado.
      id: "R3.9g",
      tipo: "audio",
      enunciado: "¿Qué debe hacer exactamente la aplicación?",
      ayuda:
        "Descríbelo paso a paso, como si se lo explicaras a quien va a " +
        "construirla. Cuanto más concreto, mejor sale la estimación.",
      obligatorio: true,
      condicion: { pregunta: "R3.1", incluye: [MODULO_APP_MEDIDA] },
    },

    {
      id: "R3.10",
      tipo: "audio",
      enunciado: "Contexto del cliente",
      ayuda: "Qué problema le duele, qué ha intentado antes, qué espera conseguir.",
      obligatorio: true,
    },
  ],
};