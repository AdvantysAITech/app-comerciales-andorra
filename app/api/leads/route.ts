import { NextResponse } from "next/server";
import {
  leadSchema,
  ETIQUETA_FUENTE,
  ETIQUETA_IDIOMA,
  ETIQUETA_SECTOR,
  ETIQUETA_EMPLEADOS,
  ETIQUETA_FACTURACION,
} from "@/lib/domain/lead";
import { ETIQUETA_LINEA, ETIQUETA_ROL } from "@/lib/domain/tipos";
import { CLASIFICACION, PREGUNTAS_BANT, calcularBant } from "@/lib/domain/bant";
import { supabaseServer } from "@/lib/supabase/server";
import { crearNota, upsertContacto } from "@/lib/ghl/contactos";
import { crearOportunidad, vincularSpinoff } from "@/lib/ghl/oportunidades";


/** Violación de índice único en Postgres. */
const CLAVE_DUPLICADA = "23505";

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

  /* ---------------------------------------------------------------- */
  /* Resolución de la spin-off                                         */
  /* ---------------------------------------------------------------- */

  // El cliente solo manda la clave interna (`educacion`, `agro`…). El id de
  // GHL y el nombre visible salen de la caché, nunca del navegador: así no
  // puede llegar un nombre que no cuadre con la spin-off, ni un id inventado.
  let spinoffGhlId: string | null = null;
  let spinoffNombre: string | null = null;

  if (esJV) {
    const { data: spinoff } = await supabase
      .from("spinoffs_cache")
      .select("ghl_id, nombre")
      .eq("clave_interna", lead.spinoffClave)
      .maybeSingle();

    if (!spinoff) {
      return NextResponse.json(
        {
          error: "Esa spin-off no está disponible",
          errores: { spinoffClave: "Vuelve a seleccionarla" },
        },
        { status: 422 },
      );
    }

    spinoffGhlId = spinoff.ghl_id;
    spinoffNombre = spinoff.nombre;
  }

  const datos = {
    uuid_origen: lead.uuid,
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
    spinoff_clave: esJV ? lead.spinoffClave : null,
    spinoff_id: spinoffGhlId,
    spinoff_nombre: spinoffNombre,
  };

  /* ---------------------------------------------------------------- */
  /* 1. Reserva — el candado de idempotencia                           */
  /* ---------------------------------------------------------------- */

  // Se inserta ANTES de tocar GHL, no después. Escribir el registro al final
  // deja la ventana abierta justo donde duele: dos peticiones con el mismo
  // UUID crearían dos oportunidades.
  let filaId: string;

  const { data: reserva, error: errorReserva } = await supabase
    .from("leads")
    .insert({ ...datos, resultado: "en_curso" })
    .select("id")
    .single();

  if (errorReserva) {
    if (errorReserva.code !== CLAVE_DUPLICADA) {
      return NextResponse.json(
        { error: "No se pudo registrar el lead. Inténtalo de nuevo." },
        { status: 500 },
      );
    }

    // Ya hay una fila con este UUID: es un reintento o una doble pulsación.
    const { data: previo } = await supabase
      .from("leads")
      .select("id, resultado, ghl_contacto_id, ghl_oportunidad_id, contacto_existia")
      .eq("uuid_origen", lead.uuid)
      .single();

    if (!previo) {
      return NextResponse.json({ error: "No se pudo recuperar el lead." }, { status: 500 });
    }

    if (previo.resultado === "creado") {
      // El primer intento sí llegó. Se devuelve su resultado tal cual: para el
      // comercial es un éxito, y en GHL sigue habiendo un único registro.
      return NextResponse.json({
        contactoId: previo.ghl_contacto_id,
        oportunidadId: previo.ghl_oportunidad_id,
        contactoExistia: previo.contacto_existia,
        repetido: true,
      });
    }

    if (previo.resultado === "en_curso") {
      return NextResponse.json(
        { error: "Este lead se está guardando ahora mismo. Espera unos segundos." },
        { status: 409 },
      );
    }

    // El intento anterior falló: se reutiliza la fila y se vuelve a intentar.
    filaId = previo.id;
    await supabase
      .from("leads")
      .update({ ...datos, resultado: "en_curso", detalle: null })
      .eq("id", filaId);
  } else {
    filaId = reserva.id;
  }

  const cerrar = (resultado: "creado" | "error", extra: Record<string, unknown>) =>
    supabase.from("leads").update({ resultado, ...extra }).eq("id", filaId);

  /* ---------------------------------------------------------------- */
  /* 2. Escritura en GHL                                               */
  /* ---------------------------------------------------------------- */

  try {
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
      sector: ETIQUETA_SECTOR[lead.sector],
      empleados: ETIQUETA_EMPLEADOS[lead.empleados],
      facturacion: ETIQUETA_FACTURACION[lead.facturacion],
      herramientas: lead.herramientas,
    });

    const oportunidad = await crearOportunidad(
      {
        empresa: lead.empresa,
        linea: lead.linea,
        rolJV: esJV ? lead.rolJV : undefined,
        spinoffId: spinoffGhlId ?? undefined,
        spinoffNombre: spinoffNombre ?? undefined,
        valorEstimado: lead.valorEstimado,
        pain: lead.pain,
        bant: lead.bant,
      },
      contacto.id,
    );

    // La spin-off es una asociación aparte, no un campo de la oportunidad.
    if (spinoffGhlId) {
      await vincularSpinoff(spinoffGhlId, oportunidad.id);
    }

    const clasificacion = esJV
      ? `${ETIQUETA_LINEA[lead.linea]} · ${spinoffNombre} · ${ETIQUETA_ROL[lead.rolJV]}`
      : ETIQUETA_LINEA[lead.linea];

    // La nota deja por escrito de dónde sale el score. Si alguien discute un
    // WARM, se ve qué se preguntó y qué se dejó en blanco, sin abrir la app.
    const detalleBant = PREGUNTAS_BANT.map((p) => {
      const opcion = p.opciones.find((o) => o.valor === lead.bant[p.id]);
      return `· ${p.etiqueta}: ${
        opcion
          ? `${opcion.etiquetaGhl} (${(opcion.puntosX100 / 100).toLocaleString("es-ES")} pt)`
          : "sin dato"
      }`;
    });

    await crearNota(
      contacto.id,
      [
        `Alta desde la App Comercial por ${user.email}.`,
        `Clasificación: ${clasificacion}.`,
        bant.respondidas > 0
          ? `BANT: ${bant.total}/10 — ${CLASIFICACION[bant.clasificacion].tag}${
              bant.completo
                ? ""
                : ` (provisional, ${bant.respondidas}/6 respondidas, techo ${bant.techo})`
            }`
          : "BANT: sin cualificar todavía.",
        ...detalleBant,
        lead.notas ? `Observaciones: ${lead.notas}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    );

    await cerrar("creado", {
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
    await cerrar("error", { detalle });
    return NextResponse.json({ error: `No se pudo guardar en GHL. ${detalle}` }, { status: 502 });
  }
}