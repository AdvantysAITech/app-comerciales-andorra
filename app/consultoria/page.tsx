import { ConexionGoogle } from '@/components/consultoria/conexion-google'

export default function ConsultoriaPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <h1 className="text-2xl font-semibold">Consultoría</h1>
      <ConexionGoogle />
    </div>
  )
}