'use client'

import { useEffect, useState } from 'react'

type Estado = { conectado: boolean; email: string | null }

export function ConexionGoogle() {
  const [estado, setEstado] = useState<Estado | null>(null)
  const [cargando, setCargando] = useState(false)

  async function cargar() {
    const res = await fetch('/api/google/estado')
    setEstado(res.ok ? await res.json() : { conectado: false, email: null })
  }

  useEffect(() => { cargar() }, [])

  async function desconectar() {
    setCargando(true)
    await fetch('/api/google/desconectar', { method: 'POST' })
    await cargar()
    setCargando(false)
  }

  if (!estado) {
    return <div className="h-20 animate-pulse rounded-lg bg-slate-100" />
  }

  const btn =
    'inline-flex items-center justify-center rounded-md px-4 py-2 ' +
    'text-sm font-medium transition-colors disabled:opacity-50 ' +
    'disabled:pointer-events-none'

  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
      <div>
        <p className="text-sm font-medium text-slate-900">Google Drive</p>
        <p className="text-sm text-slate-500">
          {estado.conectado
            ? `Conectado como ${estado.email ?? 'cuenta de Google'}`
            : 'Necesario para importar transcripciones de Meet'}
        </p>
      </div>

      {estado.conectado ? (
        <button
          type="button"
          onClick={desconectar}
          disabled={cargando}
          className={`${btn} border border-slate-300 text-slate-700 hover:bg-slate-50`}
        >
          {cargando ? 'Desconectando…' : 'Desconectar'}
        </button>
      ) : (
        <a href="/api/google/conectar" className={`${btn} bg-slate-900 text-white hover:bg-slate-800`}>
          Conectar Google
        </a>
      )}
    </div>
  )
}