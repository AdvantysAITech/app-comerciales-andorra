import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { construirDocumentoCliente } from "@/lib/documentos/cliente";
import type { Alcance } from "@/lib/ia/salida";
import type { Ruta } from "@/lib/domain/rutas";
import type { EdicionDocumento } from "@/lib/documentos/edicion";
import Acciones from "./acciones";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await supabaseServer();

  const { data: doc } = await supabase
    .from("documentos")
    .select("lead_id")
    .eq("id", id)
    .maybeSingle();

  if (!doc) return { title: "Propuesta Advantys" };

  const { data: lead } = await supabase
    .from("leads")
    .select("empresa")
    .eq("id", doc.lead_id)
    .maybeSingle();

  return {
    title: lead?.empresa
      ? `Propuesta Advantys · ${lead.empresa}`
      : "Propuesta Advantys",
  };
}

export default async function VerDocumento({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // En Next 15+ `params` es una promesa. Se extrae UNA vez aquí y se usa la
  // variable `id` en todo lo demás: pasar `params.id` sin await da undefined,
  // y el enlace de descarga acaba apuntando a /api/documentos/undefined/pdf.
  const { id } = await params;

  const supabase = await supabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  // La RLS de `documentos` ya filtra por comercial. Si la fila no aparece, o no
  // existe o no es suya: en ambos casos 404, y sin dar pistas de cuál de las dos.
  const { data: doc } = await supabase
    .from("documentos")
    // Literal de una pieza a propósito: si se parte en dos y se concatena,
    // supabase-js deja de inferir el tipo de la fila y `doc` vuelve como
    // GenericStringError.
    .select("id, alcance, validado_en, validado_version, lead_id, comercial_id, edicion, precio_editado, editado_en, ediciones, ghl_subido_en, ghl_error, ghl_version")
    .eq("id", id)
    .maybeSingle();

  if (!doc) notFound();

  const { data: lead } = await supabase
    .from("leads")
    .select("uuid_origen, empresa, ruta, precio_presentado")
    .eq("id", doc.lead_id)
    .maybeSingle();

  if (!lead) notFound();

  // `precio_editado` manda sobre el calculado. Null no significa «gratis»:
  // significa «no se ha tocado», y entonces vale el del motor —que en Ruta 4
  // ya es null de origen y hace que el documento diga que el presupuesto lo
  // elabora el equipo técnico.
  const precioEfectivo = doc.precio_editado ?? lead.precio_presentado;

  const documento = construirDocumentoCliente({
    alcance: doc.alcance as Alcance,
    ruta: lead.ruta as Ruta,
    uuid: lead.uuid_origen,
    empresa: lead.empresa,
    precio: precioEfectivo,
    edicion: doc.edicion as EdicionDocumento | null,
  });

  /**
   * Quién puede editar. La condición es la misma que la de la política
   * `documentos_update`, a propósito: quien puede leer la propuesta puede
   * modificarla. Cada comercial la suya; con alcance equipo o total,
   * cualquiera.
   *
   * Esto decide si se PINTA el botón. Quien decide de verdad es la RLS: la
   * ruta de guardado hace el UPDATE con el cliente del usuario y devuelve 403
   * si no vuelve ninguna fila. Ocultar el botón es comodidad, no seguridad.
   */
  const { data: permiso } = await supabase
    .from("permisos")
    .select("alcance")
    .eq("profile_id", user.id)
    .eq("modulo_clave", "captacion")
    .maybeSingle();

  const puedeEditar =
    doc.comercial_id === user.id ||
    permiso?.alcance === "equipo" ||
    permiso?.alcance === "total";

  /**
   * La validación no bloquea la descarga (decisión de Jacob, 24/08/2026, que
   * modifica el punto 7.6 del DERCAS): el comercial descarga el PDF en cuanto
   * se genera, y desde el 04/09 también puede modificarlo.
   *
   * Lo que sí bloquea, desde el 07/09, es la subida al CRM. Y se mira POR
   * VERSIÓN: `validado_en` no se revoca nunca, pero apunta a la versión que se
   * aprobó. Si `ediciones` ha subido desde entonces, lo que hay en pantalla es
   * otra cosa y necesita su propio visto bueno.
   */
  const versionActual = doc.ediciones ?? 0;
  const validado = doc.validado_en !== null && doc.validado_version === versionActual;

  // Hubo validación, pero de una versión anterior. Es el caso que hay que
  // contar bien: ni «sin validar» a secas ni «validado», sino «lo validaste,
  // y después esto se ha tocado».
  const validadoAntes = doc.validado_en !== null && !validado;

  return (
    <Acciones
      id={id}
      doc={documento}
      precioCalculado={lead.precio_presentado}
      puedeEditar={puedeEditar}
      validado={validado}
      validadoAntes={validadoAntes}
      versionActual={versionActual}
      ghlVersion={doc.ghl_version}
      editadoEn={doc.editado_en}
      ediciones={versionActual}
      crm={{ subidoEn: doc.ghl_subido_en, error: doc.ghl_error }}
    />
  );
}