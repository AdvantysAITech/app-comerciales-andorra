import { NextResponse } from "next/server";
import { getSupabaseRoute } from "@/lib/supabase/route-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderizarPdf } from "@/lib/documentos/render";
import { adjuntarDocumentoOportunidad } from "@/lib/ghl/documentos";
import type { EdicionDocumento } from "@/lib/documentos/edicion";
import type { Alcance } from "@/lib/ia/salida";
import type { Ruta } from "@/lib/domain/rutas";

export const runtime = "nodejs";

/**
 * Reintento de la subida al CRM.
 *
 * Existe porque la subida es «best effort» en dos sitios —al generar y al
 * editar— y hasta ahora un fallo dejaba el documento correcto en la app y
 * ausente en GHL sin ninguna forma de arreglarlo desde la interfaz. El error
 * se guardaba en `ghl_error` y ahí se quedaba.
 *
 * No recalcula ni reedita nada: sube exactamente el documento que hay.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await getSupabaseRoute();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sesión caducada" }, { status: 401 });
  }

  const { data: doc } = await supabase
    .from("documentos")
    .select("id, lead_id, alcance, edicion, precio_editado, pdf_ruta")
    .eq("id", id)
    .maybeSingle();

  if (!doc) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const { data: lead } = await supabase
    .from("leads")
    .select("uuid_origen, empresa, ruta, precio_presentado, ghl_oportunidad_id")
    .eq("id", doc.lead_id)
    .maybeSingle();

  if (!lead) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  if (!lead.ghl_oportunidad_id) {
    return NextResponse.json(
      { error: "El lead no tiene oportunidad en el Sistema Advantys." },
      { status: 409 },
    );
  }

  // Limpiar el error es lo primero que hay que hacer de todas formas, y de
  // paso sirve de control de permiso: pasa por `documentos_update`, así que si
  // este usuario no puede tocar el documento no vuelve ninguna fila.
  const { data: permitido } = await supabase
    .from("documentos")
    .update({ ghl_error: null })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (!permitido) {
    return NextResponse.json(
      { error: "No tienes permiso para modificar esta propuesta." },
      { status: 403 },
    );
  }

  const admin = createAdminClient();

  /* --- Los bytes: el archivo guardado, o uno nuevo ------------------ */

  let pdf: Uint8Array;
  let nombreArchivo: string;

  const guardado = doc.pdf_ruta
    ? await admin.storage.from("documentos").download(doc.pdf_ruta)
    : null;

  if (guardado?.data) {
    pdf = new Uint8Array(await guardado.data.arrayBuffer());
    nombreArchivo = doc.pdf_ruta!.split("/").pop() ?? "Propuesta-Advantys.pdf";
  } else {
    try {
      const render = await renderizarPdf({
        alcance: doc.alcance as Alcance,
        ruta: lead.ruta as Ruta,
        uuid: lead.uuid_origen,
        empresa: lead.empresa,
        precio: doc.precio_editado ?? lead.precio_presentado,
        edicion: doc.edicion as EdicionDocumento | null,
        baseUrl: request.url,
      });
      pdf = render.pdf;
      nombreArchivo = render.nombreArchivo;
    } catch (e) {
      const detalle = e instanceof Error ? e.message : "Error desconocido";
      await admin
        .from("documentos")
        .update({ ghl_error: `No se pudo ensamblar el PDF: ${detalle}` })
        .eq("id", id);
      return NextResponse.json({ error: `No se pudo ensamblar el PDF: ${detalle}` }, { status: 500 });
    }
  }

  /* --- Subida ------------------------------------------------------- */

  try {
    await adjuntarDocumentoOportunidad({
      oportunidadId: lead.ghl_oportunidad_id,
      pdf,
      nombreArchivo,
    });

    const subidoEn = new Date().toISOString();
    await admin
      .from("documentos")
      .update({ ghl_subido_en: subidoEn, ghl_error: null })
      .eq("id", id);

    return NextResponse.json({ ok: true, crm: { subidoEn, error: null } });
  } catch (e) {
    const detalle = e instanceof Error ? e.message : "Error desconocido";
    console.error("[crm] adjuntar en GHL falló", detalle);

    const aviso = `No se pudo actualizar en el CRM: ${detalle}`;
    await admin.from("documentos").update({ ghl_error: aviso }).eq("id", id);

    return NextResponse.json({ ok: false, crm: { subidoEn: null, error: aviso } }, { status: 502 });
  }
}
