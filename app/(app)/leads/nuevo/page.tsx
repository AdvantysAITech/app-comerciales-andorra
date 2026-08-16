import { listarSpinoffs, type Spinoff } from "@/lib/ghl/spinoffs";
import FormularioLead from "./formulario";

// El listado de spin-offs viene de GHL en vivo (RF-16). No se prerenderiza.
export const dynamic = "force-dynamic";

export default async function NuevoLead() {
  let spinoffs: Spinoff[] = [];
  let errorSpinoffs: string | null = null;

  try {
    spinoffs = await listarSpinoffs();
  } catch {
    errorSpinoffs =
      "No se ha podido leer el listado de spin-offs desde GHL. Puedes dar de alta " +
      "leads de Consultoría y de Auditoría, pero no de Joint Venture Builder.";
  }

  return (
    <div>
      <p className="traza">Alta de lead</p>
      <h1 className="mt-2 mb-8 text-2xl font-semibold tracking-tight">Nuevo lead</h1>
      <FormularioLead spinoffs={spinoffs} errorSpinoffs={errorSpinoffs} />
    </div>
  );
}