import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderizarPdf, nombreDeArchivo } from "@/lib/documentos/render";
import type { Alcance } from "@/lib/ia/salida";
import type { Ruta } from "@/lib/domain/rutas";

// react-pdf necesita Node, no el runtime Edge.
export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await supabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sesión caducada" }, { status: 401 });
  }

  /**
   * La validación ya NO bloquea la descarga (decisión de Jacob, 24/08/2026,
   * que modifica el punto 7.6 del DERCAS). Antes esta ruta devolvía 403
   * mientras `validado_en` fuese null, y era el único control real: la
   * comprobación de la pantalla se salta tecleando esta URL.
   *
   * `validado_en` se sigue registrando —la pantalla interna lo escribe y la
   * del cliente lo muestra— pero como constancia de revisión, no como puerta.
   * Quien pueda leer la fila puede descargar el PDF.
   */
  const { data: doc } = await supabase
    .from("documentos")
    .select("alcance, lead_id, pdf_ruta")
    .eq("id", id)
    .maybeSingle();

  if (!doc) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const { data: lead } = await supabase
    .from("leads")
    .select("uuid_origen, empresa, ruta, precio_presentado")
    .eq("id", doc.lead_id)
    .maybeSingle();

  if (!lead) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  /* ---------------------------------------------------------------- */
  /* 1. El archivo guardado, si lo hay                                 */
  /* ---------------------------------------------------------------- */

  /**
   * Se sirve el PDF almacenado en vez de rehacerlo.
   *
   * No es solo ahorro: el precio se RECALCULA en cada renderizado, así que dos
   * descargas separadas por un cambio de tarifas devolvían documentos
   * distintos bajo la misma referencia. El que tiene el cliente en su correo
   * y el que ves tú dejaban de coincidir sin que nadie se enterara.
   *
   * El bucket es privado, así que se lee con la service_role key: el usuario
   * ya ha pasado el control de sesión y de RLS un poco más arriba.
   */
  if (doc.pdf_ruta) {
    const admin = createAdminClient();
    const { data: archivo, error } = await admin.storage
      .from("documentos")
      .download(doc.pdf_ruta);

    if (!error && archivo) {
      return respuestaPdf(
        new Uint8Array(await archivo.arrayBuffer()),
        nombreDesdeRuta(doc.pdf_ruta),
      );
    }

    // Si el archivo se ha perdido, se rehace en vez de devolver un 500: es
    // recuperable, y el comercial no tiene por qué quedarse sin propuesta.
    console.error("[pdf] no se pudo leer de Storage, se regenera", error);
  }

  /* ---------------------------------------------------------------- */
  /* 2. Sin archivo: se ensambla al vuelo                              */
  /* ---------------------------------------------------------------- */

  const { pdf, nombreArchivo } = await renderizarPdf({
    alcance: doc.alcance as Alcance,
    ruta: lead.ruta as Ruta,
    uuid: lead.uuid_origen,
    empresa: lead.empresa,
    precio: lead.precio_presentado,
    baseUrl: request.url,
  });

  return respuestaPdf(pdf, nombreArchivo);
}

function nombreDesdeRuta(ruta: string): string {
  return ruta.split("/").pop() || nombreDeArchivo("Advantys", "propuesta");
}

function respuestaPdf(pdf: Uint8Array, nombre: string) {
  // `pdf-lib` devuelve un Uint8Array sobre ArrayBufferLike, que desde TS 5.7
  // ya no encaja en BodyInit (podría ser un SharedArrayBuffer). Reenvolverlo
  // fija el buffer a ArrayBuffer, que es lo que espera la Response.
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // Nombre sin acentos ni espacios para el parámetro clásico; el bonito va
      // en filename*, que es lo que leen los navegadores modernos.
      "Content-Disposition": `attachment; filename="${nombre}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
      "Cache-Control": "no-store",
    },
  });
}