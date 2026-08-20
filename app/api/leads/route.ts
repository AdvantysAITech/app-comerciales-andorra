import { NextResponse } from "next/server";
import { leadSchema, ETIQUETA_FUENTE, ETIQUETA_IDIOMA } from "@/lib/domain/lead";
import { ETIQUETA_LINEA, ETIQUETA_ROL } from "@/lib/domain/tipos";
import { CLASIFICACION, PREGUNTAS_BANT, calcularBant } from "@/lib/domain/bant";
import { supabaseServer } from "@/lib/supabase/server";
import { buscarContacto, crearNota, upsertContacto } from "@/lib/ghl/contactos";
import {
  crearOportunidad,
  tieneConflictoIndependencia,
  vincularSpinoff,
} from "@/lib/ghl/oportunidades";

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sesión caducada" }, { status: 401 });

  // CA-07a / CA-07b: sin clasificación completa no se guarda nada.
  const parsed = leadSchema.safeParse(await request.json());
  if (!parsed.success) {
    const errores: Record<string, string> = {};
    for (const issue of parsed.error.issues) errores[String(issue.path[0])] = issue.message;
    return NextResponse.json({ error: "Faltan campos obligatorios", errores }, { status: 422 });
  }
  const lead = parsed.data;
  const esJV = lead.linea === "jv_builder";
  const bant = calcularBant(lead.bant);

  const registrar = (
    resultado: "creado" | "bloqueado_wf16" | "error",
    extra: Record<string, unknown>,
  ) =>
    supabase.from("leads").insert({
      comercial_id: user.id,
      comercial_email: user.email,
      nombre: lead.nombre,
      email: lead.email,
      telefono: lead.telefono,
      empresa: lead.empresa,
      linea_negocio: lead.linea,
      bant_score: bant.respondidas > 0 ? bant.total : null,
      bant_clasificacion: bant.respondidas > 0 ? bant.clasificacion : null,
      bant_completo: bant.completo,
      rol_jv: esJV ? lead.rolJV : null,
      spinoff_id: esJV ? lead.spinoffId : null,
      spinoff_nombre: esJV ? lead.spinoffNombre : null,
      resultado,
      ...extra,
    });

  try {
    const existente = await buscarContacto({ email: lead.email, telefono: lead.telefono });

    // WF-16 — independencia del auditor. Se comprueba ANTES de escribir en GHL:
    // si bloqueamos después del upsert, quedaría el contacto medio actualizado
    // por una auditoría que nunca debió abrirse.
    if (lead.linea === "auditoria_iso42001" && existente) {
      const { conflicto, oportunidades } = await tieneConflictoIndependencia(existente.id);
      if (conflicto) {
        await registrar("bloqueado_wf16", {
          ghl_contacto_id: existente.id,
          contacto_existia: true,
          detalle: `${oportunidades.length} oportunidad(es) Ganada(s) en otra línea de negocio.`,
        });
        return NextResponse.json(
          {
            bloqueado: "wf16",
            error:
              "Este contacto ya es cliente de Advantys en otra línea de negocio. Advantys no puede auditarle sin romper la independencia del auditor. Habla con Jacob antes de seguir.",
            oportunidades: oportunidades.map((o) => o.name).filter(Boolean),
          },
          { status: 409 },
        );
      }
    }

    const contacto = await upsertContacto({
      nombre: lead.nombre,
      email: lead.email,
      telefono: lead.telefono,
      empresa: lead.empresa,
      cargo: lead.cargo,
      ciudadPais: lead.ciudadPais,
      web: lead.web,
      fuente: ETIQUETA_FUENTE[lead.fuente],
      idioma: ETIQUETA_IDIOMA[lead.idioma],
    });

    const oportunidad = await crearOportunidad(
      {
        empresa: lead.empresa,
        linea: lead.linea,
        rolJV: esJV ? lead.rolJV : undefined,
        spinoffId: esJV ? lead.spinoffId : undefined,
        spinoffNombre: esJV ? lead.spinoffNombre : undefined,
        valorEstimado: lead.valorEstimado,
        pain: lead.pain,
        bant: lead.bant,
      },
      contacto.id,
    );

    // La spin-off es una asociación aparte, no un campo de la oportunidad.
    if (esJV) {
      await vincularSpinoff(lead.spinoffId, oportunidad.id);
    }

    const clasificacion = esJV
      ? `${ETIQUETA_LINEA[lead.linea]} · ${lead.spinoffNombre} · ${ETIQUETA_ROL[lead.rolJV]}`
      : ETIQUETA_LINEA[lead.linea];

    // La nota deja por escrito de dónde sale el score. Si alguien discute un
    // WARM, se ve qué se preguntó y qué se dejó en blanco, sin abrir la app.
    const detalleBant = PREGUNTAS_BANT.map((p) => {
      const opcion = p.opciones.find((o) => o.valor === lead.bant[p.id]);
      return `· ${p.etiqueta}: ${opcion ? `${opcion.etiquetaGhl} (${opcion.puntosX2 / 2} pt)` : "sin dato"}`;
    });

    await crearNota(
      contacto.id,
      [
        `Alta desde la App Comercial por ${user.email}.`,
        `Clasificación: ${clasificacion}.`,
        bant.respondidas > 0
          ? `BANT: ${bant.total}/10 — ${CLASIFICACION[bant.clasificacion].tag}${
              bant.completo ? "" : ` (provisional, ${bant.respondidas}/6 respondidas, techo ${bant.techo})`
            }`
          : "BANT: sin cualificar todavía.",
        ...detalleBant,
        lead.notas ? `Observaciones: ${lead.notas}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    );

    await registrar("creado", {
      ghl_contacto_id: contacto.id,
      ghl_oportunidad_id: oportunidad.id,
      contacto_existia: !contacto.nuevo,
    });

    return NextResponse.json({
      contactoId: contacto.id,
      oportunidadId: oportunidad.id,
      contactoExistia: !contacto.nuevo,
      bant: bant.respondidas > 0 ? bant : null,
    });
  } catch (error) {
    const detalle = error instanceof Error ? error.message : "Error desconocido";
    await registrar("error", { detalle });
    return NextResponse.json({ error: `No se pudo guardar en GHL. ${detalle}` }, { status: 502 });
  }
}