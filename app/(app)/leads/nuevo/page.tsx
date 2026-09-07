import { supabaseServer } from "@/lib/supabase/server";
import type { Spinoff } from "@/lib/ghl/spinoffs";
import { RUTAS, DEFINICION_RUTA, type Ruta } from "@/lib/domain/rutas";
import { fasesDeEntrada } from "@/lib/ghl/ids";
import FormularioLead, {
  type FasesPorRuta,
  type BorradorCargado,
  type EstadoBorrador,
} from "./formulario";

export const dynamic = "force-dynamic";

export default async function NuevoLead({
  searchParams,
}: {
  searchParams: Promise<{ borrador?: string }>;
}) {
  const { borrador: uuidBorrador } = await searchParams;
  const supabase = await supabaseServer();

  /* ------------------------------------------------------------------ */
  /* Borrador que se retoma                                              */
  /* ------------------------------------------------------------------ */

  // La RLS decide si este comercial puede verlo. Si el uuid no es suyo y no
  // tiene alcance, no vuelve fila y el formulario arranca vacío: no hace
  // falta comprobar el dueño aquí.
  let borrador: BorradorCargado | null = null;

  if (uuidBorrador) {
    const { data } = await supabase
      .from("leads_borrador")
      .select("uuid, estado")
      .eq("uuid", uuidBorrador)
      .maybeSingle();

    if (data) {
      borrador = { uuid: data.uuid, estado: (data.estado ?? {}) as EstadoBorrador };
    }
  }

  // Se lee de la caché, no de GHL: el alta de un lead no puede depender de
  // que GHL responda a tiempo. La caché la refresca el cron diario.
  const { data, error } = await supabase
    .from("spinoffs_cache")
    .select("clave_interna, ghl_id, nombre, estado")
    .order("nombre");

  const spinoffs: Spinoff[] = (data ?? []).map((s) => ({
    clave: s.clave_interna,
    ghlId: s.ghl_id,
    nombre: s.nombre,
    estado: s.estado ?? undefined,
  }));

  // Las fases se resuelven aquí y viajan ya listas: así el mapa de IDs de GHL
  // se queda en servidor y el componente cliente solo recibe id y nombre.
  const fasesPorRuta = Object.fromEntries(
    RUTAS.map((r: Ruta) => {
      const def = DEFINICION_RUTA[r];
      return [r, fasesDeEntrada(def.linea, def.rolJV).map((f) => ({ id: f.id, nombre: f.nombre }))];
    }),
  ) as FasesPorRuta;

  const errorSpinoffs =
    error || spinoffs.length === 0
      ? "No hay spin-offs disponibles. Puedes dar de alta leads de consultoría " +
        "y de ISO 42001, pero no de spin-off. Avisa a Alex."
      : null;

  return (
    <div>
      <p className="traza">{borrador ? "Borrador sin terminar" : "Alta de lead"}</p>
      <h1 className="mt-2 mb-8 text-2xl font-semibold tracking-tight">
        {borrador ? "Continuar el lead" : "Nuevo lead"}
      </h1>
      <FormularioLead
        spinoffs={spinoffs}
        fasesPorRuta={fasesPorRuta}
        errorSpinoffs={errorSpinoffs}
        borrador={borrador}
      />
    </div>
  );
}