import { NextResponse } from 'next/server'
import { getUsuarioSesion } from '@/lib/supabase/route-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { parsearTranscriptMeet } from '@/lib/google/transcript'

const MIN_CARACTERES = 200
const MAX_CARACTERES = 500_000

export async function POST(request: Request) {
  const user = await getUsuarioSesion()
  if (!user) return NextResponse.json({ error: 'sin_sesion' }, { status: 401 })

  const { texto, titulo, fechaJornada } = await request.json()

  if (typeof texto !== 'string' || texto.trim().length < MIN_CARACTERES) {
    return NextResponse.json(
      { error: 'texto_insuficiente', detalle: `Mínimo ${MIN_CARACTERES} caracteres.` },
      { status: 422 },
    )
  }
  if (texto.length > MAX_CARACTERES) {
    return NextResponse.json(
      { error: 'texto_excesivo', detalle: `Máximo ${MAX_CARACTERES.toLocaleString('es-ES')} caracteres.` },
      { status: 422 },
    )
  }

  const nombre = (titulo?.trim() || 'Transcripción pegada').slice(0, 200)
  const p = parsearTranscriptMeet(texto, nombre)

  const { data, error } = await createAdminClient()
    .from('consultoria_transcripciones')
    .insert({
      creado_por: user.id,
      origen: 'pegado',
      estado: 'lista',
      nombre_fichero: nombre,
      idioma: 'es',
      texto: p.texto,
      participantes: p.participantes,
      duracion_min: p.duracionMin,
      fecha_jornada: fechaJornada || p.fechaJornada,
    })
    .select('id, nombre_fichero, num_caracteres, participantes, duracion_min, fecha_jornada')
    .single()

  if (error) {
    return NextResponse.json(
      { error: 'insert_fallido', detalle: error.message },
      { status: 500 },
    )
  }

  return NextResponse.json({ ...data, ya_existia: false })
}