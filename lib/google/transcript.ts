import 'server-only'

export type TranscriptParseado = {
  texto: string
  participantes: string[]
  duracionMin: number | null
  fechaJornada: string | null
}

/**
 * Los transcripts de Google Meet vienen como:
 *   Nombre Apellido: texto que dijo
 *   Otra Persona: respuesta
 * Con una cabecera de metadatos antes de la conversación.
 */
export function parsearTranscriptMeet(
  raw: string,
  nombreFichero: string,
): TranscriptParseado {
  const texto = raw.replace(/\r\n/g, '\n').trim()

  const participantes = new Set<string>()
  for (const linea of texto.split('\n')) {
    const m = linea.match(/^([\p{L}\p{M}][\p{L}\p{M}\s.'-]{1,60}):\s/u)
    if (m) participantes.add(m[1].trim())
  }

  // Meet nombra el fichero: "Título - 2026/08/18 10:30 CEST - Transcripción"
  let fechaJornada: string | null = null
  const fISO = nombreFichero.match(/(\d{4})[/-](\d{2})[/-](\d{2})/)
  if (fISO) {
    fechaJornada = `${fISO[1]}-${fISO[2]}-${fISO[3]}`
  } else {
    const fEU = nombreFichero.match(/(\d{2})[/-](\d{2})[/-](\d{4})/)
    if (fEU) fechaJornada = `${fEU[3]}-${fEU[2]}-${fEU[1]}`
  }

  // Estimación por volumen: ~130 palabras habladas por minuto
  const palabras = texto.split(/\s+/).length
  const duracionMin = palabras > 0 ? Math.round(palabras / 130) : null

  return { texto, participantes: [...participantes], duracionMin, fechaJornada }
}