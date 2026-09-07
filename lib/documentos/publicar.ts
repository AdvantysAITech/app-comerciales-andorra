/**
 * Publicación de un documento en el CRM.  →  lib/documentos/publicar.ts
 *
 * Existe porque desde el 07/09/2026 la subida a GHL ocurre en un solo sitio
 * conceptual —validar— pero desde dos rutas: `validar` la primera vez y `crm`
 * cuando hay que reintentar. Antes la misma secuencia estaba copiada en tres
 * ficheros y se fue separando: uno regeneraba el PDF y otro no.
 *
 * Lo que NO hace este módulo es comprobar permisos. Se llama siempre después
 * de que la ruta haya decidido que quien pregunta puede hacerlo, y por eso
 * trabaja con la service_role key. La comprobación de versión validada sí está
 * aquí, y a propósito: es una invariante del sistema, no una regla de pantalla.
 */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderizarPdf } from "@/lib/documentos/render";
import { adjuntarDocumentoOportunidad } from "@/lib/ghl/documentos";
import { versionDe, versionValidada } from "@/lib/documentos/version";
import type { EdicionDocumento, EstadoCrm } from "@/lib/documentos/edicion";
import type { Alcance } from "@/lib/ia/salida";
import type { Ruta } from "@/lib/domain/rutas";

// Se reexportan para no obligar a las rutas que ya las importan de aquí a
// cambiar el import. La definición vive en `version.ts`, que no arrastra
// react-pdf ni el cliente de GHL y por eso lo pueden usar las pantallas.
export { versionDe, versionValidada };

export async function publicarEnCrm(args: {
  documentoId: string;
  baseUrl: string;
}): Promise<EstadoCrm> {
  const admin = createAdminClient();

  const fallo = async (mensaje: string): Promise<EstadoCrm> => {
    await admin
      .from("documentos")
      .update({ ghl_error: mensaje })
      .eq("id", args.documentoId);
    return { subidoEn: null, error: mensaje };
  };

  const { data: doc } = await admin
    .from("documentos")
    .select(
      "id, lead_id, alcance, edicion, precio_editado, pdf_ruta, ediciones, validado_en, validado_version",
    )
    .eq("id", args.documentoId)
    .maybeSingle();

  if (!doc) return { subidoEn: null, error: "El documento ya no existe." };

  // Cinturón. Las rutas ya lo comprueban, pero esta es la invariante que
  // sostiene toda la decisión de Jacob: al CRM solo sube lo validado.
  if (!versionValidada(doc)) {
    return {
      subidoEn: null,
      error: "Esta versión todavía no está validada, así que no se envía al CRM.",
    };
  }

  const { data: lead } = await admin
    .from("leads")
    .select("uuid_origen, empresa, ruta, precio_presentado, ghl_oportunidad_id")
    .eq("id", doc.lead_id)
    .maybeSingle();

  if (!lead) return { subidoEn: null, error: "El lead de esta propuesta ya no existe." };

  if (!lead.ghl_oportunidad_id) {
    return fallo("El lead no tiene oportunidad en el Sistema Advantys.");
  }

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
        baseUrl: args.baseUrl,
      });
      pdf = render.pdf;
      nombreArchivo = render.nombreArchivo;
    } catch (e) {
      const detalle = e instanceof Error ? e.message : "Error desconocido";
      console.error("[publicar] render del PDF falló", detalle);
      return fallo(`No se pudo ensamblar el PDF: ${detalle}`);
    }
  }

  /* --- Subida ------------------------------------------------------- */

  try {
    await adjuntarDocumentoOportunidad({
      oportunidadId: lead.ghl_oportunidad_id,
      pdf,
      nombreArchivo,
    });
  } catch (e) {
    const detalle = e instanceof Error ? e.message : "Error desconocido";
    console.error("[publicar] adjuntar en GHL falló", detalle);
    return fallo(`No se pudo actualizar en el CRM: ${detalle}`);
  }

  const subidoEn = new Date().toISOString();

  await admin
    .from("documentos")
    .update({
      ghl_subido_en: subidoEn,
      ghl_error: null,
      ghl_version: versionDe(doc.ediciones),
    })
    .eq("id", args.documentoId);

  return { subidoEn, error: null };
}