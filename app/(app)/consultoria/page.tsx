import { ConexionGoogle } from '@/components/consultoria/conexion-google'
import { ImportarTranscript } from '@/components/consultoria/importar-transcript'
import { PegarTranscript } from '@/components/consultoria/pegar-transcript'

export default function ConsultoriaPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Consultoría</h1>
        <p className="mt-1 text-sm text-slate-500">
          Generación de DERCAS a partir de la transcripción de la jornada
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-slate-900">Conexión</h2>
        <ConexionGoogle />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-slate-900">
          Importar transcripción
        </h2>
        <ImportarTranscript />
      </section>
    </div>
  )
}