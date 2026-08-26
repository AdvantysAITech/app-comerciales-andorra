import { NextResponse } from "next/server";
import {
  leadSchema,
  ETIQUETA_FUENTE,
  ETIQUETA_IDIOMA,
  ETIQUETA_SECTOR,
  ETIQUETA_EMPLEADOS,
  ETIQUETA_FACTURACION,
  ETIQUETA_PROCESO
} from "@/lib/domain/lead";
import { DEFINICION_RUTA, ETIQUETA_RUTA, requiereSpinoff } from "@/lib/domain/rutas";
import {
  esInversor,
  muestraProcesosCriticos,
  etiquetaInfoInversores,
} from "@/lib/domain/visibilidad";
import { ETIQUETA_LINEA, ETIQUETA_ROL } from "@/lib/domain/tipos";
import { CLASIFICACION, calcularBant } from "@/lib/domain/bant";
import {
  CHECKLISTS,
  SPINOFF,
  validar,
  type RespuestasChecklist,
} from "@/lib/domain/checklists";
import { calcularPrecio } from "@/lib/precios";
import { supabaseServer } from "@/lib/supabase/server";
import { crearNota, upsertContacto } from "@/lib/ghl/contactos";
import { crearOportunidad, vincularSpinoff } from "@/lib/ghl/oportunidades";

/** Violación de índice único en Postgres. */
const CLAVE_DUPLICADA = "23505";

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sesión caducada" }, { status: 401 });

  const parsed = leadSchema.safeParse(await request.json());
  if (!parsed.success) {
    const errores: Record<string, string> = {};
    for (const issue of parsed.error.issues) errores[String(issue.path[0])] = issue.message;
    return NextResponse.json({ error: "Faltan campos obligatorios", errores }, { status: 422 });
  }

  const lead = parsed.data;
  const definicion = DEFINICION_RUTA[lead.ruta];
  const esSpinoff = requiereSpinoff(lead.ruta);
  const checklist = lead.checklist as RespuestasChecklist;

  /* ---------------------------------------------------------------- */
  /* Visibilidad                                                       */
  /* ---------------------------------------------------------------- */

  // Se vuelve a aplicar aquí lo que la pantalla ya oculta. No es desconfianza
  // del comercial: el POST se puede lanzar sin pasar por la pantalla, y un
  // BANT de inversor escrito en GHL dispararía los workflows de cualificación
  // sobre una oportunidad que no es una venta.
  const inversor = esInversor(lead.ruta);
  const conProcesos = muestraProcesosCriticos({
    ruta: lead.ruta,
    sector: lead.sector,
    spinoffClave: lead.spinoffClave,
  });

  const respuestasBant = inversor ? {} : lead.bant;
  const procesos = conProcesos ? lead.procesos : [];
  const infoInversores = inversor ? lead.quiereInfoInversores : false;

  const bant = calcularBant(respuestasBant);

  /* ---------------------------------------------------------------- */
  /* Validación del checklist                                          */
  /* ---------------------------------------------------------------- */

  // Se repite en servidor lo que ya validó el navegador. No es desconfianza
  // del comercial: es que el POST se puede lanzar sin pasar por la pantalla, y
  // un checklist incompleto produce un documento incompleto.
  const conContexto = lead.spinoffClave
    ? { ...checklist, [SPINOFF]: lead.spinoffClave }
    : checklist;

  const fallosChecklist = validar(CHECKLISTS[lead.ruta], conContexto);
  if (Object.keys(fallosChecklist).length > 0) {
    return NextResponse.json(
      { error: "El checklist está incompleto", errores: fallosChecklist },
      { status: 422 },
    );
  }

  /* ---------------------------------------------------------------- */
  /* Resolución de la spin-off                                         */
  /* ---------------------------------------------------------------- */

  // El cliente solo manda la clave interna. El id de GHL y el nombre visible
  // salen de la caché, nunca del navegador.
  let spinoffGhlId: string | null = null;
  let spinoffNombre: string | null = null;

  if (esSpinoff) {
    const { data: spinoff } = await supabase
      .from("spinoffs_cache")
      .select("ghl_id, nombre")
      .eq("clave_interna", lead.spinoffClave!)
      .maybeSingle();

    if (!spinoff) {
      return NextResponse.json(
        { error: "Esa spin-off no está disponible", errores: { spinoffClave: "Vuelve a seleccionarla" } },
        { status: 422 },
      );
    }
    spinoffGhlId = spinoff.ghl_id;
    spinoffNombre = spinoff.nombre;
  }

  /* ---------------------------------------------------------------- */
  /* Precio                                                            */
  /* ---------------------------------------------------------------- */

  // Se calcula en servidor y NO se devuelve entero al navegador: el objeto
  // Calculo lleva el suelo de negociación y el desglose, que la sección 8
  // prohíbe enseñar al comercial. Solo sale lo que filtra paraComercial().
  const calculo = calcularPrecio({ ruta: lead.ruta, respuestas: conContexto });

  const datos = {
    uuid_origen: lead.uuid,
    comercial_id: user.id,
    comercial_email: user.email,
    nombre: lead.nombre,
    email: lead.email,
    telefono: lead.telefono,
    empresa: lead.empresa,
    ruta: lead.ruta,
    linea_negocio: definicion.linea,
    servicio: definicion.servicio ?? null,
    bant_score: bant.respondidas > 0 ? bant.total : null,
    bant_clasificacion: bant.respondidas > 0 ? bant.clasificacion : null,
    bant_completo: bant.completo,
    rol_jv: definicion.rolJV ?? null,
    spinoff_clave: lead.spinoffClave ?? null,
    spinoff_id: spinoffGhlId,
    spinoff_nombre: spinoffNombre,
    checklist: lead.checklist,
    arbol: lead.arbol,
    precio_presentado: calculo.presentado,
    precio_suelo: calculo.suelo,
    precio_desglose: calculo.desglose,
    precio_version: calculo.version,
    estado_presupuesto: calculo.estado,
    motivos_revision: calculo.motivos,
    procesos,
    info_inversores: infoInversores,
    sector: lead.sector,
    empleados: lead.empleados,
    facturacion: lead.facturacion,
    ciudad_pais: lead.ciudadPais,
  };

  /* ---------------------------------------------------------------- */
  /* 1. Reserva — el candado de idempotencia                           */
  /* ---------------------------------------------------------------- */

  let filaId: string;

  const { data: reserva, error: errorReserva } = await supabase
    .from("leads")
    .insert({ ...datos, resultado: "en_curso" })
    .select("id")
    .single();

    if (errorReserva) {
    if (errorReserva.code !== CLAVE_DUPLICADA) {
      // El detalle va al log del servidor, no a la respuesta: puede contener
      // nombres de columna y restricciones, y eso no se le enseña al navegador.
      console.error("[leads] insert falló", {
        code: errorReserva.code,
        message: errorReserva.message,
        details: errorReserva.details,
        hint: errorReserva.hint,
      });
      return NextResponse.json(
        { error: "No se pudo registrar el lead. Inténtalo de nuevo." },
        { status: 500 },
      );
    }

    const { data: previo } = await supabase
      .from("leads")
      .select("id, resultado, ghl_contacto_id, ghl_oportunidad_id, contacto_existia")
      .eq("uuid_origen", lead.uuid)
      .single();

    if (!previo) {
      return NextResponse.json({ error: "No se pudo recuperar el lead." }, { status: 500 });
    }
    if (previo.resultado === "creado") {
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

    filaId = previo.id;
    await supabase.from("leads")
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
        linea: definicion.linea,
        rolJV: definicion.rolJV,
        spinoffId: spinoffGhlId ?? undefined,
        spinoffNombre: spinoffNombre ?? undefined,
        faseId: lead.faseId,
        valorEstimado: calculo.presentado ?? lead.valorEstimado,
        servicio: definicion.servicio,
        estadoPresupuesto: calculo.estado,
        bant: respuestasBant,
        uuid: lead.uuid,
        ruta: ETIQUETA_RUTA[lead.ruta],
        pain: (() => {
          const id = CHECKLISTS[lead.ruta].contexto;
          const valor = id ? conContexto[id] : undefined;
          return typeof valor === "string" ? valor : undefined;
        })(),
        procesos: procesos.map((p) => ETIQUETA_PROCESO[p]),
        // Solo se manda en rutas de inversor: en el resto el campo ni se toca.
        infoInversores: inversor ? infoInversores : undefined,
      },
      contacto.id,
    );

    if (spinoffGhlId) await vincularSpinoff(spinoffGhlId, oportunidad.id);

    await crearNota(
      contacto.id,
      [
        `Alta desde la App Comercial por ${user.email}.`,
        `Ruta: ${ETIQUETA_RUTA[lead.ruta]} — ${definicion.nombre}.`,
        esSpinoff ? `Spin-off: ${spinoffNombre} · ${ETIQUETA_ROL[definicion.rolJV!]}.` : null,
        inversor
          ? "BANT: no aplica — oportunidad de inversión, no de venta."
          : bant.respondidas > 0
            ? `BANT: ${bant.total}/10 — ${CLASIFICACION[bant.clasificacion].tag}` +
              (bant.completo ? "" : ` (provisional, ${bant.respondidas}/6)`)
            : "BANT: sin cualificar todavía.",
        inversor
          ? `Información para inversores: ${etiquetaInfoInversores(infoInversores)}.`
          : null,
        inversor
          ? "Presupuesto: no aplica — un inversor no recibe propuesta."
          : calculo.presentado !== null
            ? `Presupuesto: ${calculo.presentado.toLocaleString("es-ES")} € · ${calculo.estado}.`
            : `Presupuesto: ${calculo.estado}.`,
        // Los motivos de revisión van a la nota de GHL, que solo ven Jacob y el
        // equipo interno. Nunca al documento del cliente.
        ...calculo.motivos.map((m) => `· ${m}`),
        lead.notas ? `Observaciones: ${lead.notas}` : null,
      ].filter(Boolean).join("\n"),
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
      leadId: filaId,
      precio: calculo.presentado,
      estado: calculo.estado,
      avisos: calculo.avisos,
    });
  } catch (error) {
    const detalle = error instanceof Error ? error.message : "Error desconocido";
    await cerrar("error", { detalle });
    return NextResponse.json({ error: `No se pudo guardar en GHL. ${detalle}` }, { status: 502 });
  }
}