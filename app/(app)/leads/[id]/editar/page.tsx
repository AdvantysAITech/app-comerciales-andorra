import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { sesionActual, puedeVer } from "@/lib/permisos";
import { ETIQUETA_LINEA, ETIQUETA_ROL, type LineaNegocio, type RolJV } from "@/lib/domain/tipos";
import type { Proceso } from "@/lib/domain/lead";
import type { RespuestasBant } from "@/lib/domain/bant";
import FormularioEdicion, { type LeadEditable } from "./formulario-edicion";

export const dynamic = "force-dynamic";

export default async function EditarLead({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const sesion = await sesionActual();
  if (!sesion || !puedeVer(sesion, "captacion")) notFound();

  const supabase = await supabaseServer();

  // La RLS ya filtra por comercial y alcance: si no vuelve nada, o no existe
  // o no es suyo, y en los dos casos la respuesta es la misma.
  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!lead) notFound();

  // Un lead que no llegó a crearse en GHL no tiene nada que corregir allí.
  if (lead.resultado !== "creado") {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <p className="traza">No se puede editar</p>
        <p className="mt-3 text-sm text-tinta-media">
          Este lead no está registrado correctamente en el Sistema Advantys, así
          que no hay nada que corregir allí. Bórralo y vuelve a darlo de alta.
        </p>
        <Link href="/leads" className="boton-fantasma mt-6 inline-block">
          Volver a mis leads
        </Link>
      </div>
    );
  }

  const { data: documento } = await supabase
    .from("documentos")
    .select("id")
    .eq("lead_id", id)
    .maybeSingle();

  const editable: LeadEditable = {
    id: lead.id,
    nombre: lead.nombre ?? "",
    email: lead.email ?? "",
    telefono: lead.telefono ?? "",
    empresa: lead.empresa ?? "",
    cargo: lead.cargo ?? "",
    ciudadPais: lead.ciudad_pais ?? "",
    web: lead.web ?? "",
    fuente: lead.fuente ?? "otro",
    idioma: lead.idioma ?? "es",
    sector: lead.sector ?? "",
    empleados: lead.empleados ?? "",
    facturacion: lead.facturacion ?? "",
    herramientas: lead.herramientas ?? "",
    notas: lead.notas ?? "",
    procesos: (lead.procesos ?? []) as Proceso[],
    bant: (lead.bant ?? {}) as RespuestasBant,
    clasificacion: [
      ETIQUETA_LINEA[lead.linea_negocio as LineaNegocio],
      lead.spinoff_nombre,
      lead.rol_jv ? ETIQUETA_ROL[lead.rol_jv as RolJV] : null,
    ]
      .filter(Boolean)
      .join(" · "),
    tieneDocumento: Boolean(documento),
  };

  return (
    <div>
      <div className="mb-8">
        <p className="traza">Corregir un lead ya registrado</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {lead.nombre}
          <span className="text-tinta-media"> · {lead.empresa}</span>
        </h1>
        <p className="mt-2 text-sm text-tinta-media">
          Los cambios se aplican también en el Sistema Advantys.
        </p>
      </div>

      <FormularioEdicion lead={editable} />
    </div>
  );
}