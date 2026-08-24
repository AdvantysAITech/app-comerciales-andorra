import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { sesionActual } from "@/lib/permisos";
import { construirEntrada, datosCliente } from "@/lib/ia/entrada";
import { generarAlcance } from "@/lib/ia/generar";
import { calcularPrecio } from "@/lib/precios";
import { calcularBant } from "@/lib/domain/bant";
import type { RespuestasChecklist } from "@/lib/domain/checklists";
import { SPINOFF } from "@/lib/domain/checklists";
import type { Ruta } from "@/lib/domain/rutas";
import type { RespuestasBant } from "@/lib/domain/bant";

export const runtime = "nodejs";

// La generación tarda unos 45 s medidos. 60 es el techo del plan Hobby de
// Vercel: va justo, y por eso la respuesta de error de abajo es explícita.
export const maxDuration = 60;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "Sesión caducada" }, { status: 401 });

  const supabase = await supabaseServer();

  const { data: lead, error: errorLead } = await supabase
    .from("leads")
    .select("id, comercial_id, empresa, sector, empleados, facturacion, ciudad_pais, ruta, checklist, bant_score, spinoff_clave, spinoff_nombre, resultado")
    .eq("id", id)
    .maybeSingle();

  if (!lead) return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });

  // Un lead que no llegó a crearse en GHL no tiene alcance que documentar.
  if (lead.resultado !== "creado") {
    return NextResponse.json(
      { error: "Este lead no está registrado correctamente. Revísalo antes de generar." },
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

  if (errorLead) {
    console.error("[documento] select de lead falló", errorLead);
    return NextResponse.json(
      { error: `No se pudo leer el lead: ${JSON.stringify(errorLead)}` },
      { status: 500 },
    );
  }

  if (!lead) return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });
  
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