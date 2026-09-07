import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { sesionActual, puedeVer } from "@/lib/permisos";
import { enlaceContacto, enlaceOportunidad } from "@/lib/ghl/enlaces";
import { CLASIFICACION, type Clasificacion } from "@/lib/domain/bant";
import { ETIQUETA_LINEA, ETIQUETA_ROL, type LineaNegocio, type RolJV } from "@/lib/domain/tipos";
import ListaLeads, { type FilaLead } from "./lista";

// Igual que /leads/nuevo y /documentos. Esta página depende de la sesión y de
// datos que cambian a cada alta: nunca debe servirse desde caché.
export const dynamic = "force-dynamic";

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

  // El filtro protege la PANTALLA; la RLS de la tabla protege los DATOS.
  // Las dos capas, no una: filtrar solo aquí deja la tabla abierta a quien
  // consulte con su propio token de sesión.
  // `eliminado_en` lo escribe el cron de `/api/leads/sincronizar-crm` cuando
  // GHL responde 404: el lead se borró en el CRM. La fila se queda —es el
  // registro de auditoría de la captación— pero desaparece de la lista.
  let consulta = supabase
    .from("leads")
    .select("*")
    .is("eliminado_en", null)
    .order("creado_en", { ascending: false })
    .limit(50);

  if (soloMios) consulta = consulta.eq("comercial_id", sesion.usuario.id);

  const { data } = await consulta;
  const leads = (data ?? []) as Fila[];

  /* ------------------------------------------------------------------ */
  /* Borradores sin terminar                                             */
  /* ------------------------------------------------------------------ */

  // Van arriba y aparte: son trabajo a medias, no altas. Mezclarlos con los
  // leads registrados haría creer que el contacto ya está en su pipeline.
  // `eliminado_en` lo escribe la misma sincronización que marca los leads:
  // si el contacto se borró en GHL, el borrador deja de mostrarse.
  let consultaBorradores = supabase
    .from("leads_borrador")
    .select("uuid, nombre, empresa, actualizado_en, ghl_error")
    .is("eliminado_en", null)
    .order("actualizado_en", { ascending: false })
    .limit(20);

  if (soloMios) consultaBorradores = consultaBorradores.eq("comercial_id", sesion.usuario.id);

  const { data: datosBorradores, error: errorBorradores } = await consultaBorradores;

  // Un fallo aquí NO puede quedarse mudo. Sin esto, una tabla que no existe o
  // una columna mal escrita se ven exactamente igual que «no hay borradores»,
  // y el comercial da por perdido lo que sí había guardado.
  if (errorBorradores) {
    console.error("[leads] no se pudieron leer los borradores", {
      code: errorBorradores.code,
      message: errorBorradores.message,
      details: errorBorradores.details,
      hint: errorBorradores.hint,
    });
  }

  const borradores = (datosBorradores ?? []).map((b) => ({
    uuid: b.uuid as string,
    nombre: b.nombre as string,
    empresa: b.empresa as string,
    ghlError: (b.ghl_error ?? null) as string | null,
    fecha: new Date(b.actualizado_en as string).toLocaleString("es-ES", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: ZONA,
    }),
  }));

  /* ------------------------------------------------------------------ */
  /* Documentos ya generados                                             */
  /* ------------------------------------------------------------------ */

  // Una sola consulta acotada a los leads de esta página, en vez de una por
  // fila. La RLS de `documentos` sigue mandando: si el comercial no puede ver
  // un documento, no vuelve, y su lead aparecerá como pendiente.
  const documentoPorLead = new Map<string, string>();

  if (leads.length > 0) {
    const { data: documentos } = await supabase
      .from("documentos")
      .select("id, lead_id")
      .in("lead_id", leads.map((l) => l.id));

    for (const d of documentos ?? []) documentoPorLead.set(d.lead_id, d.id);
  }

  const filas: FilaLead[] = leads.map((lead) => {
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
      documentoId: documentoPorLead.get(lead.id) ?? null,
      // Se decide en servidor a partir del rol ya guardado, no reinterpretando
      // la ruta en el navegador.
      esInversor: lead.rol_jv === "inversor",
    };
  });

  return (
    <div>
      {/* El botón de alta vive en la cabecera y NO dentro del estado vacío.
          Antes solo aparecía con la lista a cero: en cuanto había un lead,
          el comercial se quedaba sin forma de crear el siguiente desde aquí. */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="traza">
            {soloMios ? "Altas hechas desde esta app" : `Altas del equipo · alcance ${alcance}`}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {soloMios ? "Mis leads" : "Leads del equipo"}
          </h1>
        </div>

        <Link href="/leads/nuevo" className="boton">
          Nuevo lead
        </Link>
      </div>

      {errorBorradores && (
        <p className="mb-8 border-l-2 border-block bg-elevado px-4 py-3 text-sm">
          No se han podido cargar los leads sin terminar. Si habías guardado alguno,
          sigue estando: es la consulta la que falla, no el borrador. El detalle está
          en el log del servidor.
        </p>
      )}

      {borradores.length > 0 && (
        <section className="mb-8">
          <p className="traza mb-3">Sin terminar</p>
          <ul className="divide-y divide-line border border-line bg-surface">
            {borradores.map((b) => (
              <li key={b.uuid}>
                <Link
                  href={`/leads/nuevo?borrador=${b.uuid}`}
                  className="flex min-h-14 items-baseline justify-between gap-4 px-4 py-3 hover:bg-elevado"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{b.nombre}</span>
                    <span className="traza mt-0.5 block truncate normal-case">
                      {b.empresa}
                      {b.ghlError && " · el contacto no llegó al CRM"}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="traza block text-block">Continuar</span>
                    <span className="traza block">{b.fecha}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {filas.length === 0 && borradores.length === 0 ? (
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
        filas.length > 0 && (
          <ListaLeads leads={filas} puedeDocumentos={puedeVer(sesion, "documentos")} />
        )
      )}
    </div>
  );
}