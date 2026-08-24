import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { supabaseServer } from "@/lib/supabase/server";
import { construirDocumentoCliente } from "@/lib/documentos/cliente";
import { DocumentoPdf } from "@/lib/documentos/pdf";
import { cargarPiezas } from "@/lib/documentos/estaticos";
import { ensamblarDocumento } from "@/lib/documentos/ensamblar";
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
    .select("alcance, lead_id")
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

  const documento = construirDocumentoCliente({
    alcance: doc.alcance as Alcance,
    ruta: lead.ruta as Ruta,
    uuid: lead.uuid_origen,
    empresa: lead.empresa,
    precio: lead.precio_presentado,
  });

  // El logo se lee por HTTP desde la propia app en vez de con `fs`: los
  // ficheros de /public no siempre están en el sistema de archivos de una
  // función serverless, pero la CDN siempre los sirve.
  const logo = new URL("/logo-advantys.png", request.url).toString();

  // El cuerpo y las piezas se preparan a la vez: son independientes entre sí.
  const [cuerpo, piezas] = await Promise.all([
    renderToBuffer(<DocumentoPdf doc={documento} logo={logo} />),
    cargarPiezas(),
  ]);

  const pdf = await ensamblarDocumento({
    cuerpo: new Uint8Array(cuerpo),
    piezas,
    marca: {
      empresa: documento.empresa,
      referencia: documento.referencia,
      fecha: documento.fecha,
    },
  });

  // Nombre sin acentos ni espacios para el parámetro clásico; el bonito va en
  // filename*, que es lo que leen los navegadores modernos.
  const limpio = documento.empresa
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const nombre = `Propuesta-Advantys-${limpio}-${documento.referencia}.pdf`;

  // `pdf-lib` devuelve un Uint8Array sobre ArrayBufferLike, que desde TS 5.7
  // ya no encaja en BodyInit (podría ser un SharedArrayBuffer). Reenvolverlo
  // fija el buffer a ArrayBuffer, que es lo que espera la Response.
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombre}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
      "Cache-Control": "no-store",
    },
  });
}