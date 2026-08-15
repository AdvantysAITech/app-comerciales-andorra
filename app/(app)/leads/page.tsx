import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { ETIQUETA_LINEA, ETIQUETA_ROL, type LineaNegocio, type RolJV } from "@/lib/domain/tipos";

type Fila = {
  id: string;
  creado_en: string;
  nombre: string;
  empresa: string;
  linea_negocio: LineaNegocio;
  rol_jv: RolJV | null;
  spinoff_nombre: string | null;
  contacto_existia: boolean;
  resultado: "creado" | "bloqueado_wf16" | "error";
};

export default async function MisLeads() {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("leads")
    .select("*")
    .order("creado_en", { ascending: false })
    .limit(50);

  const leads = (data ?? []) as Fila[];

  return (
    <div>
      <p className="traza">Altas hechas desde esta app</p>
      <h1 className="mt-2 mb-8 text-2xl font-semibold tracking-tight">Mis leads</h1>

      {leads.length === 0 ? (
        <div className="border border-dashed border-line p-10 text-center">
          <p className="text-muted">Todavía no has dado de alta ningún lead.</p>
          <Link href="/leads/nuevo" className="boton mt-5 inline-block">
            Dar de alta el primero
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-line border border-line bg-surface">
          {leads.map((lead) => (
            <li key={lead.id} className="flex items-baseline justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {lead.nombre}
                  <span className="text-muted"> · {lead.empresa}</span>
                </p>
                <p className="traza mt-0.5 truncate normal-case">
                  {ETIQUETA_LINEA[lead.linea_negocio]}
                  {lead.spinoff_nombre ? ` · ${lead.spinoff_nombre}` : ""}
                  {lead.rol_jv ? ` · ${ETIQUETA_ROL[lead.rol_jv]}` : ""}
                  {lead.contacto_existia ? " · contacto actualizado" : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                {lead.resultado === "bloqueado_wf16" && (
                  <span className="traza text-block">Bloqueado · WF-16</span>
                )}
                {lead.resultado === "error" && (
                  <span className="traza text-block">No guardado</span>
                )}
                <p className="traza">
                  {new Date(lead.creado_en).toLocaleDateString("es-ES", {
                    day: "2-digit",
                    month: "short",
                  })}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}