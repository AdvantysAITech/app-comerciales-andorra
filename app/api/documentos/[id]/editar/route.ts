import { NextResponse } from "next/server";
import { getSupabaseRoute } from "@/lib/supabase/route-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderizarPdf } from "@/lib/documentos/render";
import { adjuntarDocumentoOportunidad } from "@/lib/ghl/documentos";
import { cuerpoEdicionSchema, detalleZod } from "@/lib/documentos/edicion";
import type { Alcance } from "@/lib/ia/salida";
import type { Ruta } from "@/lib/domain/rutas";

// react-pdf necesita Node, no el runtime Edge.
export const runtime = "nodejs";

/**
 * Guardar una propuesta editada.
 *
 * El orden de las operaciones no es casual:
 *
 *   1. Se actualiza la fila con el cliente del USUARIO. Ese UPDATE es la
 *      puerta: si la política `documentos_update` no le deja, no vuelve
 *      ninguna fila y se corta con un 403. El permiso no se comprueba dos
 *      veces en dos sitios que puedan discrepar.
 *   2. Solo después se archiva y se regenera, ya con la service_role key.
 *      Al revés se archivaría el estado previo de una edición que luego se
 *      rechaza, y el historial acabaría lleno de versiones que nunca fueron.
 *
 * Storage y GHL van como «best effort»: si fallan, el guardado sigue siendo
 * válido y el fallo queda escrito en `ghl_error`. Perder la conexión con el
 * CRM no puede impedirle a nadie corregir una propuesta.
 */
export async function PATCH(
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

  /* ---------------------------------------------------------------- */
  /* 1. Validación del cuerpo                                          */
  /* ---------------------------------------------------------------- */

  let bruto: unknown;
  try {
    bruto = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo no válido" }, { status: 400 });
  }

  const parsed = cuerpoEdicionSchema.safeParse(bruto);
  if (!parsed.success) {
    return NextResponse.json({ error: detalleZod(parsed.error) }, { status: 400 });
  }

  const { edicion, precio } = parsed.data;

  /* ---------------------------------------------------------------- */
  /* 2. Estado actual                                                  */
  /* ---------------------------------------------------------------- */

  const { data: doc } = await supabase
    .from("documentos")
    .select("id, lead_id, alcance, edicion, precio_editado, pdf_ruta, ediciones")
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

  const version = (doc.ediciones ?? 0) + 1;

  /* ---------------------------------------------------------------- */
  /* 3. Guardado · aquí se comprueba el permiso                        */
  /* ---------------------------------------------------------------- */

  const { data: guardado, error: errorGuardado } = await supabase
    .from("documentos")
    .update({
      edicion,
      precio_editado: precio,
      editado_por: user.id,
      editado_en: new Date().toISOString(),
      ediciones: version,
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (errorGuardado) {
    console.error("[editar] no se pudo guardar la edición", errorGuardado);
    return NextResponse.json(
      { error: "No se pudo guardar la propuesta." },
      { status: 500 },
    );
  }

  // Fila legible pero no actualizable: la RLS la ha filtrado en el UPDATE.
  if (!guardado) {
    return NextResponse.json(
      { error: "No tienes permiso para modificar esta propuesta." },
      { status: 403 },
    );
  }

  const admin = createAdminClient();

  /* ---------------------------------------------------------------- */
  /* 4. Historial de la versión anterior                               */
  /* ---------------------------------------------------------------- */

  // Se guarda `precio_calculado` en cada versión aunque hoy no cambie: es la
  // columna con la que se medirá, cuando entre el motor nuevo de tarifas,
  // cuánto se está bajando el precio a mano.
  const { error: errorHistorial } = await admin.from("documentos_ediciones").insert({
    documento_id: id,
    version,
    edicion_previa: doc.edicion,
    precio_previo: doc.precio_editado,
    precio_calculado: lead.precio_presentado,
    pdf_ruta_previa: doc.pdf_ruta,
    editado_por: user.id,
  });

  if (errorHistorial) {
    // No se aborta: la edición ya está guardada y revertirla sería peor.
    console.error("[editar] no se pudo archivar la versión previa", errorHistorial);
  }

  // Copia del PDF anterior antes de pisarlo. Sin esto, «se sobrescribe la
  // misma referencia» significaría que el archivo que tiene el cliente en su
  // correo ya no existe en ningún sitio.
  if (doc.pdf_ruta) {
    const nombrePrevio = doc.pdf_ruta.split("/").pop() ?? "propuesta.pdf";
    const destino = `${id}/historial/v${version}-${nombrePrevio}`;

    const { error: errorCopia } = await admin.storage
      .from("documentos")
      .copy(doc.pdf_ruta, destino);

    if (errorCopia) {
      console.error("[editar] no se pudo archivar el PDF previo", errorCopia);
    } else {
      await admin
        .from("documentos_ediciones")
        .update({ pdf_ruta_previa: destino })
        .eq("documento_id", id)
        .eq("version", version);
    }
  }

  /* ---------------------------------------------------------------- */
  /* 5. PDF nuevo                                                      */
  /* ---------------------------------------------------------------- */

  // `precio_editado` manda sobre el calculado. Null significa «vale el del
  // motor», no «sin precio»: en Ruta 4 el calculado ya es null de origen.
  const precioEfectivo = precio ?? lead.precio_presentado;

  let pdf: Uint8Array;
  let nombreArchivo: string;

  try {
    const render = await renderizarPdf({
      alcance: doc.alcance as Alcance,
      ruta: lead.ruta as Ruta,
      uuid: lead.uuid_origen,
      empresa: lead.empresa,
      precio: precioEfectivo,
      edicion,
      baseUrl: request.url,
    });
    pdf = render.pdf;
    nombreArchivo = render.nombreArchivo;
  } catch (e) {
    const detalle = e instanceof Error ? e.message : "Error desconocido";
    console.error("[editar] render del PDF falló", detalle);

    // Se anula la ruta guardada: el archivo que hay en Storage es el de antes
    // de esta edición, y servirlo sería mandarle al cliente un precio que ya
    // no es el que hay en pantalla. Con `pdf_ruta` a null, la descarga lo
    // ensambla al vuelo y sale correcto aunque más lento.
    await admin
      .from("documentos")
      .update({
        pdf_ruta: null,
        ghl_error: `No se pudo regenerar el PDF: ${detalle}`,
      })
      .eq("id", id);

    return NextResponse.json({
      ok: true,
      pdfRegenerado: false,
      crm: { subidoEn: null, error: `No se pudo regenerar el PDF: ${detalle}` },
    });
  }

  /* ---------------------------------------------------------------- */
  /* 6. Storage                                                        */
  /* ---------------------------------------------------------------- */

  const rutaStorage = `${id}/${nombreArchivo}`;

  const { error: errorSubida } = await admin.storage
    .from("documentos")
    .upload(rutaStorage, pdf, { contentType: "application/pdf", upsert: true });

  if (errorSubida) {
    console.error("[editar] subida a Storage falló", errorSubida);
    await admin
      .from("documentos")
      .update({ pdf_ruta: null, ghl_error: `No se pudo guardar el PDF: ${errorSubida.message}` })
      .eq("id", id);
  } else {
    // El nombre del archivo lleva dentro el nombre de la empresa, así que si
    // se ha corregido una errata la ruta cambia. El original ya está copiado
    // en `historial/`; el de la ruta vieja se borra para no dejar huérfanos.
    if (doc.pdf_ruta && doc.pdf_ruta !== rutaStorage) {
      await admin.storage.from("documentos").remove([doc.pdf_ruta]);
    }

    await admin
      .from("documentos")
      .update({ pdf_ruta: rutaStorage, pdf_generado_en: new Date().toISOString() })
      .eq("id", id);
  }

  /* ---------------------------------------------------------------- */
  /* 7. CRM                                                            */
  /* ---------------------------------------------------------------- */

  if (!lead.ghl_oportunidad_id) {
    const aviso = "El lead no tiene oportunidad en el Sistema Advantys.";
    await admin.from("documentos").update({ ghl_error: aviso }).eq("id", id);
    return NextResponse.json({
      ok: true,
      pdfRegenerado: true,
      crm: { subidoEn: null, error: aviso },
    });
  }

  try {
    // Reemplaza el archivo del campo «Documentacion»: hay un presupuesto por
    // lead, así que la versión editada sustituye a la anterior en el CRM.
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

    return NextResponse.json({ ok: true, pdfRegenerado: true, crm: { subidoEn, error: null } });
  } catch (e) {
    const detalle = e instanceof Error ? e.message : "Error desconocido";
    console.error("[editar] adjuntar en GHL falló", detalle);

    const aviso = `No se pudo actualizar en el CRM: ${detalle}`;
    await admin.from("documentos").update({ ghl_error: aviso }).eq("id", id);

    return NextResponse.json({
      ok: true,
      pdfRegenerado: true,
      crm: { subidoEn: null, error: aviso },
    });
  }
}
