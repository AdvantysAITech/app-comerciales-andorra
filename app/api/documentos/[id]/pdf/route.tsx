import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { supabaseServer } from "@/lib/supabase/server";
import { construirDocumentoCliente } from "@/lib/documentos/cliente";
import { DocumentoPdf } from "@/lib/documentos/pdf";
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

  const { data: doc } = await supabase
    .from("documentos")
    .select("alcance, validado_en, lead_id")
    .eq("id", id)
    .maybeSingle();

  if (!doc) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  /**
   * 7.6: el documento de cliente no se descarga hasta que Jacob valida.
   *
   * Esta es la comprobación que de verdad cuenta. La de la página se salta
   * tecleando esta URL, y esta URL es justo la que se comparte.
   */
  if (!doc.validado_en) {
    return NextResponse.json(
      { error: "Este documento todavía no está validado. Jacob debe revisarlo." },
      { status: 403 },
    );
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

  const pdf = await renderToBuffer(<DocumentoPdf doc={documento} logo={logo} />);

  // Nombre sin acentos ni espacios para el parámetro clásico; el bonito va en
  // filename*, que es lo que leen los navegadores modernos.
  const limpio = documento.empresa
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const nombre = `Propuesta-Advantys-${limpio}-${documento.referencia}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombre}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
      "Cache-Control": "no-store",
    },
  });
}