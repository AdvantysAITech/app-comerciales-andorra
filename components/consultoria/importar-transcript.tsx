'use client'

import { useState, useCallback } from 'react'

declare global { interface Window { google: any; gapi: any } }

type Resultado = {
  id: string
  nombre_fichero: string | null
  num_caracteres: number
  participantes?: string[]
  duracion_min?: number | null
  fecha_jornada?: string | null
  ya_existia: boolean
}

function cargarScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve()
    const s = document.createElement('script')
    s.src = src
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`No se pudo cargar ${src}`))
    document.body.appendChild(s)
  })
}

export function ImportarTranscript({
  onImportado,
}: {
  onImportado?: (r: Resultado) => void
}) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<Resultado | null>(null)

  const abrirPicker = useCallback(async () => {
    setError(null)
    setCargando(true)

    try {
      const tokenRes = await fetch('/api/google/picker-token')
      if (!tokenRes.ok) {
        const e = await tokenRes.json()
        throw new Error(
          e.error === 'sin_conexion_google'
            ? 'Conecta tu cuenta de Google antes de importar.'
            : 'No se pudo obtener el acceso a Drive.',
        )
      }
      const { accessToken, apiKey, appId } = await tokenRes.json()

      await cargarScript('https://apis.google.com/js/api.js')
      await new Promise<void>((r) => window.gapi.load('picker', () => r()))

      const vista = new window.google.picker.DocsView(
        window.google.picker.ViewId.DOCS,
      )
        .setIncludeFolders(true)
        .setSelectFolderEnabled(false)
        .setMode(window.google.picker.DocsViewMode.LIST)

      const picker = new window.google.picker.PickerBuilder()
        .setAppId(appId)
        .setDeveloperKey(apiKey)
        .setOAuthToken(accessToken)
        .addView(vista)
        .setTitle('Selecciona la transcripción de la jornada')
        .setLocale('es')
        .setCallback(async (data: any) => {
          if (data.action !== window.google.picker.Action.PICKED) {
            if (data.action === window.google.picker.Action.CANCEL) {
              setCargando(false)
            }
            return
          }

          const doc = data.docs[0]
          try {
            const res = await fetch(
              '/api/consultoria/transcripciones/importar-drive',
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  fileId: doc.id,
                  fileName: doc.name,
                  mimeType: doc.mimeType,
                }),
              },
            )
            const json = await res.json()
            if (!res.ok) throw new Error(json.detalle ?? json.error)

            setResultado(json)
            onImportado?.(json)
          } catch (e: any) {
            setError(e.message ?? 'Error al importar la transcripción.')
          } finally {
            setCargando(false)
          }
        })
        .build()

      picker.setVisible(true)
    } catch (e: any) {
      setError(e.message ?? 'Error inesperado.')
      setCargando(false)
    }
  }, [onImportado])

  const btn =
    'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm ' +
    'font-medium bg-slate-900 text-white hover:bg-slate-800 ' +
    'disabled:opacity-50 disabled:pointer-events-none'

  return (
    <div className="space-y-3">
      <button type="button" onClick={abrirPicker} disabled={cargando} className={btn}>
        {cargando ? 'Abriendo Drive…' : 'Importar desde Google Drive'}
      </button>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {resultado && (
        <div className="rounded-md border border-slate-200 p-4 text-sm">
          <p className="font-medium">
            {resultado.ya_existia
              ? 'Esta transcripción ya estaba importada'
              : 'Transcripción importada'}
          </p>
          <dl className="mt-2 space-y-1 text-slate-600">
            <div>
              <dt className="inline">Fichero: </dt>
              <dd className="inline">{resultado.nombre_fichero ?? '—'}</dd>
            </div>
            <div>
              <dt className="inline">Caracteres: </dt>
              <dd className="inline">
                {resultado.num_caracteres.toLocaleString('es-ES')}
              </dd>
            </div>
            {resultado.duracion_min ? (
              <div>
                <dt className="inline">Duración estimada: </dt>
                <dd className="inline">{resultado.duracion_min} min</dd>
              </div>
            ) : null}
            {resultado.fecha_jornada ? (
              <div>
                <dt className="inline">Fecha de la jornada: </dt>
                <dd className="inline">{resultado.fecha_jornada}</dd>
              </div>
            ) : null}
            {resultado.participantes?.length ? (
              <div>
                <dt className="inline">Participantes: </dt>
                <dd className="inline">{resultado.participantes.join(', ')}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      )}
    </div>
  )
}