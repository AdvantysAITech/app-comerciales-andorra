'use client'

import { useState } from 'react'

type Resultado = {
  id: string
  nombre_fichero: string | null
  num_caracteres: number
  participantes?: string[]
  duracion_min?: number | null
  fecha_jornada?: string | null
}

export function PegarTranscript({
  onImportado,
}: {
  onImportado?: (r: Resultado) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const [titulo, setTitulo] = useState('')
  const [fecha, setFecha] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<Resultado | null>(null)

  async function guardar() {
    setError(null)
    setGuardando(true)
    try {
      const res = await fetch('/api/consultoria/transcripciones/pegar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texto,
          titulo: titulo || null,
          fechaJornada: fecha || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.detalle ?? json.error)

      setResultado(json)
      setTexto('')
      setTitulo('')
      setFecha('')
      setAbierto(false)
      onImportado?.(json)
    } catch (e: any) {
      setError(e.message ?? 'No se pudo guardar la transcripción.')
    } finally {
      setGuardando(false)
    }
  }

  const input =
    'w-full rounded-md border border-slate-300 px-3 py-2 text-sm ' +
    'focus:border-slate-900 focus:outline-none'

  if (!abierto && !resultado) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="text-sm text-slate-600 underline underline-offset-4 hover:text-slate-900"
      >
        O pegar la transcripción manualmente
      </button>
    )
  }

  return (
    <div className="space-y-3">
      {abierto && (
        <div className="space-y-3 rounded-lg border border-slate-200 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Título</label>
              <input
                className={input}
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Jornada de consultoría — Cliente X"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Fecha de la jornada</label>
              <input
                type="date"
                className={input}
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Transcripción</label>
            <textarea
              className={`${input} min-h-[240px] font-mono text-xs`}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={'Jacob Ruiz: Buenos días, vamos a empezar…\nCliente: Perfecto…'}
            />
            <p className="mt-1 text-xs text-slate-500">
              {texto.length.toLocaleString('es-ES')} caracteres
              {texto.length > 0 && texto.length < 200 && ' — mínimo 200'}
            </p>
          </div>

          {error && (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={guardar}
              disabled={guardando || texto.trim().length < 200}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 disabled:pointer-events-none"
            >
              {guardando ? 'Guardando…' : 'Guardar transcripción'}
            </button>
            <button
              type="button"
              onClick={() => { setAbierto(false); setError(null) }}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {resultado && (
        <div className="rounded-md border border-slate-200 p-4 text-sm">
          <p className="font-medium">Transcripción guardada</p>
          <dl className="mt-2 space-y-1 text-slate-600">
            <div>
              <dt className="inline">Título: </dt>
              <dd className="inline">{resultado.nombre_fichero ?? '—'}</dd>
            </div>
            <div>
              <dt className="inline">Caracteres: </dt>
              <dd className="inline">{resultado.num_caracteres.toLocaleString('es-ES')}</dd>
            </div>
            {resultado.participantes?.length ? (
              <div>
                <dt className="inline">Participantes: </dt>
                <dd className="inline">{resultado.participantes.join(', ')}</dd>
              </div>
            ) : null}
          </dl>
          <button
            type="button"
            onClick={() => { setResultado(null); setAbierto(true) }}
            className="mt-3 text-sm text-slate-600 underline underline-offset-4 hover:text-slate-900"
          >
            Pegar otra
          </button>
        </div>
      )}
    </div>
  )
}