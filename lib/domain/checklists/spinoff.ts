/**
 * RUTA 6 · Spin-off Cliente Final y RUTA 7 · Spin-off Inversor.
 *
 * Ninguna de las dos calcula precio. La 6 produce una carta de intenciones y
 * deja el valor de la oportunidad vacío; la 7 guarda como valor el importe que
 * declara el inversor.
 *
 * R6.1 y R7.1 del documento —qué spin-off le interesa— NO están aquí: eso se
 * elige en el paso de clasificación, donde ya es obligatorio para poder
 * guardar. Repetirlo daría dos fuentes de verdad para el mismo dato. La
 * spin-off elegida se inyecta en las respuestas bajo la clave SPINOFF, y las
 * preguntas que cambian por vertical se condicionan a ella.
 */

import type { Checklist } from "./tipos";
import { SPINOFF } from "./tipos";

const soloSpinoff = (clave: string) => ({ pregunta: SPINOFF, incluye: [clave] });

/* ================================================================== */
/* RUTA 6 · Cliente Final                                              */
/* ================================================================== */

export const CHECKLIST_RUTA_6: Checklist = {
  ruta: "ruta_6",
  contexto: "R6.6",
  intro:
    "Sin precio y sin cálculo. El objetivo es identificar interés real y " +
    "producir una carta de intenciones.",
  preguntas: [
    /* R6.2 — el tipo de organización cambia por vertical. */
    {
      id: "R6.2",
      tipo: "seleccion_unica",
      enunciado: "¿Qué tipo de organización es?",
      obligatorio: true,
      opciones: [
        { valor: "universidad", etiqueta: "Universidad privada" },
        { valor: "colegio", etiqueta: "Colegio privado" },
        { valor: "grupo_educativo", etiqueta: "Grupo educativo" },
        { valor: "fp", etiqueta: "Formación profesional" },
      ],
      condicion: soloSpinoff("educacion"),
    },
    {
      id: "R6.2",
      tipo: "seleccion_unica",
      enunciado: "¿Qué tipo de organización es?",
      obligatorio: true,
      opciones: [
        { valor: "productor", etiqueta: "Productor" },
        { valor: "cooperativa", etiqueta: "Cooperativa" },
        { valor: "distribuidor", etiqueta: "Distribuidor" },
        { valor: "transformadora", etiqueta: "Industria transformadora" },
      ],
      condicion: soloSpinoff("agro"),
    },
    {
      id: "R6.2",
      tipo: "seleccion_unica",
      enunciado: "¿Qué tipo de organización es?",
      obligatorio: true,
      opciones: [
        { valor: "despacho", etiqueta: "Despacho profesional" },
        { valor: "asesoria", etiqueta: "Asesoría" },
        { valor: "particular", etiqueta: "Cliente particular" },
      ],
      condicion: soloSpinoff("residencia"),
    },
    {
      id: "R6.2",
      tipo: "seleccion_unica",
      enunciado: "¿Qué tipo de organización es?",
      obligatorio: true,
      opciones: [
        { valor: "hotel", etiqueta: "Hotel independiente" },
        { valor: "cadena", etiqueta: "Cadena" },
        { valor: "restauracion", etiqueta: "Restauración" },
        { valor: "apartamentos", etiqueta: "Apartamentos turísticos" },
      ],
      condicion: soloSpinoff("hospitality"),
    },

    /* R6.3 — la métrica de dimensión cambia por vertical. */
    {
      id: "R6.3",
      tipo: "numero",
      enunciado: "¿Cuántos alumnos tiene?",
      obligatorio: true,
      min: 1,
      unidad: "alumnos",
      condicion: soloSpinoff("educacion"),
    },
    {
      id: "R6.3",
      tipo: "numero",
      enunciado: "¿Cuántas explotaciones o referencias hay que trazar?",
      obligatorio: true,
      min: 1,
      condicion: soloSpinoff("agro"),
    },
    {
      id: "R6.3",
      tipo: "numero",
      enunciado: "¿Cuántos expedientes gestiona al año?",
      obligatorio: true,
      min: 1,
      unidad: "expedientes/año",
      condicion: soloSpinoff("residencia"),
    },
    {
      id: "R6.3",
      tipo: "texto",
      enunciado: "¿Cuántos establecimientos y habitaciones?",
      ayuda: "Por ejemplo: 3 hoteles, 240 habitaciones en total.",
      obligatorio: true,
      condicion: soloSpinoff("hospitality"),
    },

    {
      id: "R6.4",
      tipo: "seleccion_unica",
      enunciado: "Nivel de interés declarado",
      obligatorio: true,
      opciones: [
        { valor: "curiosidad", etiqueta: "Curiosidad exploratoria" },
        { valor: "interes_real", etiqueta: "Interés real, quiere ver más" },
        { valor: "firmar_intencion", etiqueta: "Dispuesto a firmar intención" },
        { valor: "calendario", etiqueta: "Quiere calendario de implantación" },
      ],
    },
    {
      id: "R6.5",
      tipo: "seleccion_unica",
      enunciado: "¿Quién decide en su organización?",
      obligatorio: true,
      opciones: [
        { valor: "es_decisor", etiqueta: "Es el decisor" },
        { valor: "comite", etiqueta: "Decide un comité o patronato" },
        { valor: "direccion", etiqueta: "Hay que subir a dirección general" },
      ],
    },
    {
      id: "R6.6",
      tipo: "audio",
      enunciado: "¿Qué le ha motivado el interés?",
      obligatorio: true,
    },
    {
      id: "R6.7",
      tipo: "texto_largo",
      enunciado: "¿Ha manifestado alguna condición o reserva?",
      obligatorio: false,
    },
  ],
};

/* ================================================================== */
/* RUTA 7 · Inversor                                                   */
/* ================================================================== */

export const CHECKLIST_RUTA_7: Checklist = {
  ruta: "ruta_7",
  contexto: "R7.7",
  intro:
    "Sin cálculo. El capital objetivo ya está fijado por ronda. El importe que " +
    "declare el inversor se guarda como valor de la oportunidad.",
  preguntas: [
    {
      id: "R7.2",
      tipo: "seleccion_unica",
      enunciado: "Tipo de inversor",
      obligatorio: true,
      opciones: [
        { valor: "particular", etiqueta: "Particular" },
        { valor: "family_office", etiqueta: "Family office" },
        { valor: "profesional", etiqueta: "Inversor profesional o fondo" },
        { valor: "industrial", etiqueta: "Industrial del sector" },
      ],
    },
    {
      id: "R7.3",
      tipo: "seleccion_unica",
      enunciado: "¿Qué importe plantea aportar?",
      obligatorio: true,
      opciones: [
        { valor: "menos_50k", etiqueta: "Menos de 50.000 €" },
        { valor: "50_150k", etiqueta: "Entre 50.000 y 150.000 €" },
        { valor: "150_300k", etiqueta: "Entre 150.000 y 300.000 €" },
        { valor: "mas_300k", etiqueta: "Más de 300.000 €" },
      ],
    },
    {
      // Si ha dicho una cifra concreta, es la que va al valor de la
      // oportunidad; el rango solo sirve cuando no la ha dicho.
      id: "R7.3a",
      tipo: "numero",
      enunciado: "¿Ha dicho un importe exacto?",
      ayuda: "Déjalo vacío si solo ha hablado en rangos.",
      obligatorio: false,
      min: 0,
      unidad: "€",
    },
    {
      id: "R7.4",
      tipo: "seleccion_unica",
      enunciado: "Horizonte declarado",
      obligatorio: true,
      opciones: [
        { valor: "3_5", etiqueta: "Busca salida a 3-5 años" },
        { valor: "5_10", etiqueta: "A 5-10 años" },
        { valor: "indefinida", etiqueta: "Permanencia indefinida" },
        { valor: "no_planteado", etiqueta: "No lo ha planteado" },
      ],
    },
    {
      id: "R7.5",
      tipo: "seleccion_unica",
      enunciado: "¿Ha visto ya documentación?",
      obligatorio: true,
      opciones: [
        { valor: "nada", etiqueta: "Nada" },
        { valor: "presentacion", etiqueta: "Presentación comercial" },
        { valor: "documento_completo", etiqueta: "Documento completo de inversión" },
        { valor: "due_diligence", etiqueta: "Ha pedido due diligence" },
      ],
    },
    {
      id: "R7.6",
      tipo: "seleccion_unica",
      enunciado: "¿Aporta algo además de capital?",
      obligatorio: true,
      opciones: [
        { valor: "solo_capital", etiqueta: "Solo capital" },
        { valor: "contactos", etiqueta: "Contactos comerciales" },
        { valor: "conocimiento", etiqueta: "Conocimiento del sector" },
        { valor: "rol_operativo", etiqueta: "Quiere rol operativo" },
      ],
    },
    {
      id: "R7.7",
      tipo: "audio",
      enunciado: "Notas de la conversación",
      ayuda: "Qué ha dicho, qué le preocupa, qué ha preguntado y en qué tono.",
      obligatorio: true,
    },
  ],
};