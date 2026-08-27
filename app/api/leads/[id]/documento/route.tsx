import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sesionActual } from "@/lib/permisos";
import { construirEntrada, datosCliente } from "@/lib/ia/entrada";
import { generarAlcance } from "@/lib/ia/generar";
import { renderizarPdf } from "@/lib/documentos/render";
import { adjuntarDocumentoOportunidad } from "@/lib/ghl/documentos";
import { calcularPrecio } from "@/lib/precios";
import { calcularBant } from "@/lib/domain/bant";
import type { RespuestasChecklist } from "@/lib/domain/checklists";
import { SPINOFF } from "@/lib/domain/checklists";
import type { Ruta } from "@/lib/domain/rutas";
import { generaPresupuesto } from "@/lib/domain/visibilidad";
import type { RespuestasBant } from "@/lib/domain/bant";
import type { Alcance } from "@/lib/ia/salida";

export const runtime = "nodejs";

// La generación tarda unos 45 s medidos. 60 es el techo del plan Hobby de
// Vercel: va justo, y por eso la respuesta de error de abajo es explícita.
export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "Sesión caducada" }, { status: 401 });

  const supabase = await supabaseServer();

  const { data: lead, error: errorLead } = await supabase
    .from("leads")
    .select("id, comercial_id, empresa, sector, empleados, facturacion, ciudad_pais, ruta, checklist, bant_score, spinoff_clave, spinoff_nombre, resultado, uuid_origen, ghl_oportunidad_id")
    .eq("id", id)
    .maybeSingle();

  if (errorLead) {
    console.error("[documento] select de lead falló", errorLead);
    return NextResponse.json(
      { error: `No se pudo leer el lead: ${JSON.stringify(errorLead)}` },
      { status: 500 },
    );
  }

  if (!lead) return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });

  // Un lead que no llegó a crearse en GHL no tiene alcance que documentar.
  if (lead.resultado !== "creado") {
    return NextResponse.json(
      { error: "Este lead no está registrado correctamente. Revísalo antes de generar." },
      { status: 409 },
    );
  }

  // A un inversor no se le genera propuesta. El botón ya no se ofrece en
  // ninguna pantalla, pero el endpoint es público para cualquier sesión
  // válida y una llamada directa no puede saltarse la regla.
  if (!generaPresupuesto(lead.ruta as Ruta)) {
    return NextResponse.json(
      {
        error:
          "Este lead es un inversor: no lleva propuesta. La información de " +
          "inversión se la envía el Sistema Advantys automáticamente.",
      },
      { status: 409 },
    );
  }

  // Idempotencia barata: si ya hay documento, se devuelve en vez de pagar
  // otra llamada a la IA. Una doble pulsación no cuesta 45 segundos ni tokens.
  const { data: existente } = await supabase
    .from("documentos")
    .select("id")
    .eq("lead_id", id)
    .maybeSingle();

  if (existente) return NextResponse.json({ documentoId: existente.id, repetido: true });

  const ruta = lead.ruta as Ruta;
  const respuestas = (lead.checklist ?? {}) as RespuestasChecklist;
  const conContexto = lead.spinoff_clave
    ? { ...respuestas, [SPINOFF]: lead.spinoff_clave }
    : respuestas;

  // El precio se RECALCULA aquí en vez de leerse de la fila. Son los mismos
  // datos y el mismo motor, pero así el documento nunca sale con un importe
  // guardado bajo una versión de tarifas anterior.
  const calculo = calcularPrecio({ ruta, respuestas: conContexto });

  const bant = calcularBant(
    (lead.bant_score !== null ? {} : {}) as RespuestasBant,
  );

  const entrada = construirEntrada({
    ruta,
    respuestas: conContexto,
    cliente: datosCliente({
      empresa: lead.empresa,
      sector: lead.sector,
      empleados: lead.empleados,
      facturacion: lead.facturacion,
      ciudadPais: lead.ciudad_pais ?? "",
    }),
    bant,
    calculo,
    spinoffNombre: lead.spinoff_nombre ?? undefined,
  });

  try {
    const resultado = await generarAlcance({ ruta, respuestas: conContexto, entrada, calculo });

    const { data: doc, error } = await supabase
      .from("documentos")
      .insert({
        lead_id: lead.id,
        comercial_id: lead.comercial_id,
        modelo: resultado.traza.modelo,
        version_prompt: resultado.traza.versionPrompt,
        entrada: resultado.entrada,
        salida_cruda: resultado.traza.salidaCruda,
        alcance: resultado.alcance,
        tokens_entrada: resultado.traza.tokensEntrada,
        tokens_salida: resultado.traza.tokensSalida,
        baseline_horas: resultado.coherencia?.baseline ?? null,
        estimado_horas: resultado.coherencia?.estimadoIa ?? null,
        desviacion: resultado.coherencia?.desviacion ?? null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[documento] insert falló", error);
      return NextResponse.json({ error: "No se pudo guardar el documento." }, { status: 500 });
    }

    // Los motivos de revisión que aporta la IA (confianza baja, desviación del
    // baseline) se suman a los que ya venían del cálculo de precio: el estado
    // final del presupuesto lo deciden los dos juntos, no solo el importe.
    if (resultado.motivosExtra.length > 0) {
      await supabase
        .from("leads")
        .update({
          estado_presupuesto: "revision_obligatoria",
          motivos_revision: [...calculo.motivos, ...resultado.motivosExtra],
        })
        .eq("id", lead.id);
    }

    /* ---------------------------------------------------------------- */
    /* PDF: se materializa, se guarda y se sube al CRM                   */
    /* ---------------------------------------------------------------- */

    /**
     * Todo este bloque va en su propio try y NUNCA tumba la respuesta.
     *
     * El documento ya está generado y guardado: la llamada cara a la IA está
     * pagada. Si falla el PDF, Storage o GHL, el comercial sigue teniendo su
     * propuesta —la ruta de descarga la ensambla al vuelo si no hay archivo—
     * y el fallo queda anotado en la fila para poder rastrearlo. Devolver un
     * error aquí obligaría a regenerar, y regenerar cuesta 45 segundos y
     * tokens por un problema que no está en el documento.
     */
    await materializarPdf({
      documentoId: doc.id,
      alcance: resultado.alcance,
      ruta,
      uuid: lead.uuid_origen,
      empresa: lead.empresa,
      precio: calculo.presentado,
      oportunidadId: lead.ghl_oportunidad_id,
      baseUrl: request.url,
    });

    return NextResponse.json({
      documentoId: doc.id,
      // Solo lo que el comercial puede ver. Ni horas, ni baseline, ni desviación.
      confianza: resultado.alcance.confianza,
      necesitaValidacion: true,
    });
  } catch (e) {
    const detalle = e instanceof Error ? e.message : "Error desconocido";
    console.error("[documento] generación falló", detalle);
    return NextResponse.json(
      { error: `No se pudo generar el documento. ${detalle}` },
      { status: 502 },
    );
  }
}

/* ================================================================== */

/**
 * Ensambla el PDF, lo guarda en Storage y lo adjunta a la oportunidad.
 *
 * Se traga sus propios errores por diseño (ver arriba). Lo que no hace es
 * tragárselos en silencio: cada fallo queda en `documentos.ghl_error` y en el
 * log del servidor.
 */
async function materializarPdf(args: {
  documentoId: string;
  alcance: Alcance;
  ruta: Ruta;
  uuid: string;
  empresa: string;
  precio: number | null;
  oportunidadId: string | null;
  baseUrl: string;
}) {
  const admin = createAdminClient();

  let pdf: Uint8Array;
  let nombreArchivo: string;

  try {
    const render = await renderizarPdf({
      alcance: args.alcance,
      ruta: args.ruta,
      uuid: args.uuid,
      empresa: args.empresa,
      precio: args.precio,
      baseUrl: args.baseUrl,
    });
    pdf = render.pdf;
    nombreArchivo = render.nombreArchivo;
  } catch (e) {
    const detalle = e instanceof Error ? e.message : "Error desconocido";
    console.error("[documento] render del PDF falló", detalle);
    await admin
      .from("documentos")
      .update({ ghl_error: `No se pudo ensamblar el PDF: ${detalle}` })
      .eq("id", args.documentoId);
    return;
  }

  /* --- Storage ------------------------------------------------------ */

  // El id del documento va en la ruta: es único y hace que regenerar (si algún
  // día se permite) no pise el archivo anterior de otro documento.
  const rutaStorage = `${args.documentoId}/${nombreArchivo}`;

  const { error: errorSubida } = await admin.storage
    .from("documentos")
    .upload(rutaStorage, pdf, { contentType: "application/pdf", upsert: true });

  if (errorSubida) {
    console.error("[documento] subida a Storage falló", errorSubida);
    await admin
      .from("documentos")
      .update({ ghl_error: `No se pudo guardar el PDF: ${errorSubida.message}` })
      .eq("id", args.documentoId);
  } else {
    await admin
      .from("documentos")
      .update({ pdf_ruta: rutaStorage, pdf_generado_en: new Date().toISOString() })
      .eq("id", args.documentoId);
  }

  /* --- GHL ---------------------------------------------------------- */

  // Sin oportunidad no hay dónde adjuntar. No es un fallo: el lead pudo
  // crearse con el contacto y sin oportunidad.
  if (!args.oportunidadId) {
    await admin
      .from("documentos")
      .update({ ghl_error: "El lead no tiene oportunidad en el Sistema Advantys." })
      .eq("id", args.documentoId);
    return;
  }

  try {
    await adjuntarDocumentoOportunidad({
      oportunidadId: args.oportunidadId,
      pdf,
      nombreArchivo,
    });

    await admin
      .from("documentos")
      .update({ ghl_subido_en: new Date().toISOString(), ghl_error: null })
      .eq("id", args.documentoId);
  } catch (e) {
    const detalle = e instanceof Error ? e.message : "Error desconocido";
    console.error("[documento] adjuntar en GHL falló", detalle);
    await admin
      .from("documentos")
      .update({ ghl_error: `No se pudo adjuntar en el CRM: ${detalle}` })
      .eq("id", args.documentoId);
  }
}