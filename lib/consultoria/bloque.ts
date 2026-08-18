export type BloqueDef = {
  numero: number
  clave: string
  titulo: string
  /** Qué debe contener. Va literal al prompt de generación. */
  instruccion: string
  /** Formato esperado de salida. */
  formato: 'texto_corto' | 'texto_largo' | 'lista' | 'lista_numerada' | 'lista_bdd' | 'tabla'
  /** Si es false, se rellena desde GHL o por el consultor, no por la IA. */
  generaIA: boolean
}

export const BLOQUES_DERCAS: BloqueDef[] = [
  {
    numero: 1,
    clave: 'identificador_proyecto',
    titulo: 'Identificador del proyecto',
    instruccion: 'Código único del expediente. Se asigna automáticamente, no se deduce de la transcripción.',
    formato: 'texto_corto',
    generaIA: false,
  },
  {
    numero: 2,
    clave: 'cliente_datos_empresa',
    titulo: 'Cliente y datos de empresa',
    instruccion: 'Razón social, NIF/CIF y persona de contacto. Proceden de la ficha del cliente, no de la transcripción.',
    formato: 'texto_corto',
    generaIA: false,
  },
  {
    numero: 3,
    clave: 'fecha_jornada',
    titulo: 'Fecha de la jornada de consultoría',
    instruccion: 'Fecha de la sesión de diagnóstico.',
    formato: 'texto_corto',
    generaIA: false,
  },
  {
    numero: 4,
    clave: 'transcripcion_fuente',
    titulo: 'Transcripción / fuente',
    instruccion: 'Referencia a la transcripción de origen.',
    formato: 'texto_corto',
    generaIA: false,
  },
  {
    numero: 5,
    clave: 'contexto_actual',
    titulo: 'Contexto actual del cliente',
    instruccion:
      'Situación de partida: cómo trabajan hoy, qué procesos siguen, qué herramientas usan y qué les duele. ' +
      'Prioriza lo que dijo el CLIENTE sobre lo que propuso el consultor. Describe el estado actual, no la solución.',
    formato: 'texto_largo',
    generaIA: true,
  },
  {
    numero: 6,
    clave: 'objetivos_negocio',
    titulo: 'Objetivos de negocio',
    instruccion:
      'Qué quiere conseguir el cliente con el proyecto, en términos de negocio y no de tecnología. ' +
      'Si mencionó cifras, plazos o metas concretas, recógelas literalmente.',
    formato: 'lista',
    generaIA: true,
  },
  {
    numero: 7,
    clave: 'alcance',
    titulo: 'Alcance del proyecto',
    instruccion:
      'Qué se incluye y qué queda explícitamente fuera. El fuera de alcance es tan importante como el dentro: ' +
      'si en la conversación se descartó algo, recógelo. Separa en dos apartados: "Incluye" y "No incluye".',
    formato: 'texto_largo',
    generaIA: true,
  },
  {
    numero: 8,
    clave: 'modulos_entidades',
    titulo: 'Módulos / Entidades a parametrizar',
    instruccion:
      'Desglose por sistema (CRM, gestión de proyectos, facturación, etc.) de qué hay que configurar. ' +
      'Agrupa por sistema y detalla entidades y campos cuando se hayan mencionado.',
    formato: 'lista',
    generaIA: true,
  },
  {
    numero: 9,
    clave: 'automatizaciones',
    titulo: 'Automatizaciones requeridas',
    instruccion:
      'Una entrada por automatización, siempre con tres partes: disparador, condición y acción. ' +
      'Si alguna de las tres no se dedujo de la conversación, escríbela como "Pendiente de confirmar".',
    formato: 'lista',
    generaIA: true,
  },
  {
    numero: 10,
    clave: 'integraciones',
    titulo: 'Integraciones entre sistemas',
    instruccion:
      'Flujo de datos entre plataformas: qué sale de dónde, hacia dónde va y en qué momento. ' +
      'Indica la dirección de cada integración.',
    formato: 'lista',
    generaIA: true,
  },
  {
    numero: 11,
    clave: 'requerimientos_funcionales',
    titulo: 'Requerimientos funcionales',
    instruccion:
      'Lista numerada con formato RF-01, RF-02… Cada uno describe qué debe HACER el sistema, no cómo. ' +
      'Redacta en tercera persona y en presente ("El sistema registra…"). ' +
      'Un requerimiento por comportamiento observable; no agrupes varios en uno.',
    formato: 'lista_numerada',
    generaIA: true,
  },
  {
    numero: 12,
    clave: 'criterios_aceptacion',
    titulo: 'Criterios de aceptación',
    instruccion:
      'Formato BDD estricto: "Dado que [contexto] / Cuando [acción] / Entonces [resultado esperado]". ' +
      'Numera como CA-01, CA-02… y referencia entre paréntesis el RF que valida cada uno. ' +
      'Cada criterio debe ser verificable de forma objetiva: nada de "funciona correctamente".',
    formato: 'lista_bdd',
    generaIA: true,
  },
  {
    numero: 13,
    clave: 'sla_soporte',
    titulo: 'SLA y soporte posventa',
    instruccion:
      'Modelo de soporte acordado y sus niveles. Si en la conversación no se habló de soporte, ' +
      'márcalo como "Pendiente de confirmar" — no inventes niveles ni tiempos de respuesta.',
    formato: 'texto_largo',
    generaIA: true,
  },
  {
    numero: 14,
    clave: 'estimacion',
    titulo: 'Estimación de horas / hitos',
    instruccion:
      'Desglose por fase. Si el proyecto es por bolsa de horas, desglosa en horas; si es cerrado, en hitos de entrega. ' +
      'Si no se dieron cifras en la conversación, escribe "Pendiente de confirmar" — NUNCA estimes por tu cuenta.',
    formato: 'tabla',
    generaIA: true,
  },
  {
    numero: 15,
    clave: 'inversion_total',
    titulo: 'Inversión total',
    instruccion:
      'Importe acordado. Solo si se mencionó explícitamente una cifra en la conversación. ' +
      'En caso contrario, "Pendiente de confirmar". No calcules ni extrapoles importes.',
    formato: 'texto_corto',
    generaIA: true,
  },
  {
    numero: 16,
    clave: 'pendientes_alertas',
    titulo: 'Pendientes / alertas',
    instruccion:
      'Vacíos de definición, contradicciones detectadas y riesgos que deben resolverse antes de iniciar el desarrollo. ' +
      'Incluye aquí TODO lo que hayas marcado como "Pendiente de confirmar" en los bloques anteriores, ' +
      'indicando de qué bloque procede. Añade también incoherencias entre lo que dijo el cliente en distintos ' +
      'momentos de la conversación, si las hubo.',
    formato: 'lista',
    generaIA: true,
  },
  {
    numero: 17,
    clave: 'estado_firma',
    titulo: 'Estado de firma',
    instruccion: 'Pendiente / Firmado. Lo gestiona la plataforma.',
    formato: 'texto_corto',
    generaIA: false,
  },
]

export const BLOQUES_IA = BLOQUES_DERCAS.filter((b) => b.generaIA)

export function bloquePorNumero(n: number): BloqueDef | undefined {
  return BLOQUES_DERCAS.find((b) => b.numero === n)
}