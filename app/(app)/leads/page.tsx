import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { sesionActual, puedeVer } from "@/lib/permisos";
import { enlaceContacto, enlaceOportunidad } from "@/lib/ghl/enlaces";
import { CLASIFICACION, type Clasificacion } from "@/lib/domain/bant";
import { ETIQUETA_LINEA, ETIQUETA_ROL, type LineaNegocio, type RolJV } from "@/lib/domain/tipos";
import ListaLeads, { type FilaLead } from "./lista";

type Fila = {
  id: string;
  creado_en: string;
  comercial_email: string | null;
  nombre: string;
  empresa: string;
  linea_negocio: LineaNegocio;
  rol_jv: RolJV | null;
  spinoff_nombre: string | null;
  contacto_existia: boolean;
  resultado: "en_curso" | "creado" | "bloqueado_wf16" | "error";
  detalle: string | null;
  bant_score: number | null;
  bant_clasificacion: Clasificacion | null;
  bant_completo: boolean | null;
  ghl_contacto_id: string | null;
  ghl_oportunidad_id: string | null;
};

/** Zona horaria del negocio, no la del teléfono: dos comerciales en husos
 *  distintos tienen que ver la misma hora para el mismo lead. */
const ZONA = "Europe/Andorra";

export default async function MisLeads() {
  const sesion = await sesionActual();
  if (!sesion || !puedeVer(sesion, "captacion")) notFound();

  const alcance = sesion.alcances.captacion;
  const soloMios = alcance === "propio";

  const supabase = await supabaseServer();

  // El alcance `propio` de lib/permisos.ts estaba modelado desde el principio
  // pero no se aplicaba: la consulta era un select("*") pelado bajo el título
  // "Mis leads", y Antonio José y Samuel se veían los leads el uno del otro.
  //
  // Este filtro es la mitad del arreglo. La otra mitad es la RLS de
  // 2026-08-24-rls-leads.sql: filtrar solo aquí protege la PANTALLA, no los
  // DATOS — cualquiera con el token de sesión puede consultar la tabla por su
  // cuenta. Las dos capas, no una.
  let consulta = supabase
    .from("leads")
    .select("*")
    .order("creado_en", { ascending: false })
    .limit(50);

  if (soloMios) consulta = consulta.eq("comercial_id", sesion.usuario.id);

  const { data } = await consulta;

  const filas: FilaLead[] = ((data ?? []) as Fila[]).map((lead) => {
    const fecha = new Date(lead.creado_en);
    return {
      id: lead.id,
      nombre: lead.nombre,
      empresa: lead.empresa,
      fechaCorta: fecha.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
        timeZone: ZONA,
      }),
      fechaLarga: fecha.toLocaleString("es-ES", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: ZONA,
      }),
      comercialEmail: lead.comercial_email,
      clasificacion: [
        ETIQUETA_LINEA[lead.linea_negocio],
        lead.spinoff_nombre,
        lead.rol_jv ? ETIQUETA_ROL[lead.rol_jv] : null,
      ]
        .filter(Boolean)
        .join(" · "),
      contactoExistia: lead.contacto_existia,
      resultado: lead.resultado,
      detalle: lead.detalle,
      bantTexto:
        lead.bant_score === null || lead.bant_clasificacion === null
          ? null
          : `${lead.bant_score.toLocaleString("es-ES")} de 10 · ${
              CLASIFICACION[lead.bant_clasificacion].tag
            }${lead.bant_completo ? "" : " (provisional)"}`,
      // Se resuelven aquí, en servidor, para no exponer el location id.
      enlaceContacto: enlaceContacto(lead.ghl_contacto_id),
      enlaceOportunidad: enlaceOportunidad(lead.ghl_oportunidad_id),
    };
  });

  return (
    <div>
      <p className="traza">
        {soloMios ? "Altas hechas desde esta app" : `Altas de todo el equipo · alcance ${alcance}`}
      </p>
      <h1 className="mt-2 mb-8 text-2xl font-semibold tracking-tight">
        {soloMios ? "Mis leads" : "Leads del equipo"}
      </h1>

      {filas.length === 0 ? (
        <div className="border border-dashed border-line p-10 text-center">
          <p className="text-tinta-media">
            {soloMios
              ? "Todavía no has dado de alta ningún lead."
              : "Todavía no hay ningún lead dado de alta."}
          </p>
          <Link href="/leads/nuevo" className="boton mt-5 inline-block">
            Dar de alta el primero
          </Link>
        </div>
      ) : (
        <ListaLeads leads={filas} />
      )}
    </div>
  );
}