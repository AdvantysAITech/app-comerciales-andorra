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
  rutaReencaminada,
  validar,
  type RespuestasChecklist,
} from "@/lib/domain/checklists";
import { calcularPrecio } from "@/lib/precios";
import { supabaseServer } from "@/lib/supabase/server";
import { crearNota, upsertContacto } from "@/lib/ghl/contactos";
import { crearOportunidad, vincularSpinoff } from "@/lib/ghl/oportunidades";
import { usuarioGhlPorEmail } from "@/lib/ghl/ids";
import { GhlError } from "@/lib/ghl/client";

/** Violación de índice único en Postgres. */
const CLAVE_DUPLICADA = "23505";

/**
 * Una reserva `en_curso` más vieja que esto se da por huérfana: la función que
 * la tomó murió (timeout, despliegue, caída) sin llegar a cerrarla. Sin este
 * límite, ese lead devolvía 409 para siempre. Tres minutos dejan de sobra el
 * tiempo de una escritura normal en GHL, incluido su reintento por 429.
 */
const RESERVA_CADUCA_MS = 3 * 60 * 1000;

/**
 * `leads` no tiene una columna que diga CUÁNDO se tomó la reserva: `creado_en`
 * solo vale para el primer intento, porque un reintento reutiliza la fila. Así
 * que mientras la fila está `en_curso`, `detalle` lleva esta marca con la hora.
 * Sirve para dos cosas: medir la caducidad y hacer de testigo en el
 * compare-and-swap (dos reintentos que leen la misma marca no pueden tomar la
 * fila los dos). Si algún día se añade `reservado_en`, esto sobra.
 */
const MARCA_RESERVA = "Guardando en GHL desde ";

function reservadaEn(fila: { detalle: string | null; creado_en: string | null }): number {
  if (fila.detalle?.startsWith(MARCA_RESERVA)) {
    const t = Date.parse(fila.detalle.slice(MARCA_RESERVA.length));
    if (!Number.isNaN(t)) return t;
  }
  // Filas reservadas antes de existir la marca. Si tampoco hay fecha, NaN hace
  // que la reserva no caduque nunca: mejor un 409 que dos escrituras en GHL.
  return fila.creado_en ? Date.parse(fila.creado_en) : Number.NaN;
}

/** Lo que hace falta leer de un intento anterior con el mismo uuid. */
type FilaPrevia = {
  id: string;
  resultado: string;
  detalle: string | null;
  creado_en: string | null;
  ruta: string | null;
  spinoff_clave: string | null;
  ghl_contacto_id: string | null;
  ghl_oportunidad_id: string | null;
  contacto_existia: boolean | null;
};

/**
 * GHL rechaza una asociación que ya existe. En un reintento que reutiliza la
 * oportunidad eso significa «ya estaba hecho», no un fallo. El texto exacto del
 * rechazo no está documentado, de ahí que se busque por palabras.
 */
function esRelacionRepetida(error: unknown): boolean {
  if (!(error instanceof GhlError) || ![400, 409, 422].includes(error.status)) return false;
  return /already|exist|duplicate/i.test(JSON.stringify(error.body ?? ""));
}

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

  // R4.1 = «Nada» convierte el lead en RUTA 2. La pantalla lo aplica al salir
  // del checklist; aquí se rechaza en vez de reencaminar, porque la ruta nueva
  // tiene su propio checklist y ese no se ha respondido. Va antes de `validar`
  // por la misma razón que en `rutaReencaminada`: no tiene sentido exigir la
  // documentación de una ruta que ya no es la del lead.
  const reencaminada = rutaReencaminada(CHECKLISTS[lead.ruta], conContexto);
  if (reencaminada && reencaminada !== lead.ruta) {
    const mensaje =
      `Con esas respuestas el lead pasa a ${DEFINICION_RUTA[reencaminada].nombre}. ` +
      `Vuelve al checklist para responder el suyo.`;
    return NextResponse.json(
      { error: mensaje, errores: { checklist: mensaje } },
      { status: 422 },
    );
  }

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
    ciudad: lead.ciudad,
    pais: lead.pais,
  };

  /* ---------------------------------------------------------------- */
  /* 1. Reserva — el candado de idempotencia                           */
  /* ---------------------------------------------------------------- */

  let filaId: string;
  /** Lo que dejó un intento anterior con el mismo uuid. Null en el primero. */
  let previo: FilaPrevia | null = null;

  const marcaReserva = () => MARCA_RESERVA + new Date().toISOString();

  const { data: reserva, error: errorReserva } = await supabase
    .from("leads")
    .insert({ ...datos, resultado: "en_curso", detalle: marcaReserva() })
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

    const { data: fila, error: errorPrevio } = await supabase
      .from("leads")
      .select(
        "id, resultado, detalle, creado_en, ruta, spinoff_clave, " +
          "ghl_contacto_id, ghl_oportunidad_id, contacto_existia",
      )
      .eq("uuid_origen", lead.uuid)
      .single<FilaPrevia>();

    if (!fila) {
      if (errorPrevio) console.error("[leads] lectura del intento previo falló", errorPrevio);
      return NextResponse.json({ error: "No se pudo recuperar el lead." }, { status: 500 });
    }
    previo = fila;

    if (previo.resultado === "creado") {
      // Mismo cierre que el camino normal: si el lead venía de un borrador y la
      // primera respuesta no llegó al navegador, el borrador se quedaba
      // colgado en «Sin terminar» apuntando a un lead que ya existe.
      const { error: errorBorrador } = await supabase
        .from("leads_borrador").delete().eq("uuid", lead.uuid);
      if (errorBorrador) console.error("[leads] borrado del borrador falló", errorBorrador);

      return NextResponse.json({
        contactoId: previo.ghl_contacto_id,
        oportunidadId: previo.ghl_oportunidad_id,
        contactoExistia: previo.contacto_existia,
        repetido: true,
      });
    }

    const caducada = Date.now() - reservadaEn(previo) > RESERVA_CADUCA_MS;
    if (previo.resultado === "en_curso" && !caducada) {
      return NextResponse.json(
        { error: "Este lead se está guardando ahora mismo. Espera unos segundos." },
        { status: 409 },
      );
    }

    // Compare-and-swap: solo se toma la fila si sigue exactamente como se
    // leyó. Sin esto, dos reintentos simultáneos pasaban los dos y escribían
    // los dos en GHL. El resultado basta para `error`; para una reserva
    // caducada no, porque sigue `en_curso` antes y después, y por eso se
    // compara también la marca de `detalle`.
    const toma = supabase
      .from("leads")
      .update({ ...datos, resultado: "en_curso", detalle: marcaReserva() })
      .eq("id", previo.id)
      .eq("resultado", previo.resultado);
    const { data: tomadas, error: errorToma } = await (
      previo.detalle === null ? toma.is("detalle", null) : toma.eq("detalle", previo.detalle)
    ).select("id");

    if (errorToma) {
      console.error("[leads] reintento: no se pudo tomar la reserva", errorToma);
      return NextResponse.json(
        { error: "No se pudo registrar el lead. Inténtalo de nuevo." },
        { status: 500 },
      );
    }
    if (!tomadas?.length) {
      return NextResponse.json(
        { error: "Este lead se está guardando ahora mismo. Espera unos segundos." },
        { status: 409 },
      );
    }

    filaId = previo.id;
  } else {
    filaId = reserva.id;
  }

  /** Apunta en la fila lo ya creado en GHL. Se hace en cuanto existe cada
   *  cosa, no al final: si la función muere a medias, el siguiente intento
   *  necesita saber qué hay en GHL para no duplicarlo. */
  const anotar = async (campos: Record<string, unknown>) => {
    const { error } = await supabase.from("leads").update(campos).eq("id", filaId);
    if (error) console.error("[leads] no se pudo anotar el progreso", { uuid: lead.uuid, campos, error });
  };

  const cerrar = async (resultado: "creado" | "error", extra: Record<string, unknown>) => {
    const { error } = await supabase
      .from("leads")
      .update({ resultado, ...extra })
      .eq("id", filaId);
    // Si falla, la fila se queda `en_curso` y caduca sola: el siguiente
    // intento la retoma y, con los ids ya anotados, no duplica nada.
    if (error) console.error(`[leads] cierre como «${resultado}» falló`, { uuid: lead.uuid, error });
  };

  // La oportunidad de un intento anterior se reutiliza solo si era para la
  // misma ruta y la misma spin-off. Si el comercial cambió la clasificación
  // entre intentos, la vieja está en otro pipeline: reutilizarla dejaría el
  // lead mal clasificado sin que nadie lo vea, y eso es peor que una
  // oportunidad sobrante, que al menos está a la vista.
  const mismaClasificacion =
    previo?.ruta === lead.ruta && (previo?.spinoff_clave ?? null) === (lead.spinoffClave ?? null);
  const oportunidadPrevia = mismaClasificacion ? (previo?.ghl_oportunidad_id ?? null) : null;
  if (previo?.ghl_oportunidad_id && !oportunidadPrevia) {
    console.warn("[leads] la clasificación cambió entre intentos; queda una oportunidad huérfana", {
      uuid: lead.uuid,
      oportunidadHuerfana: previo.ghl_oportunidad_id,
    });
  }

  let contactoId: string | undefined;
  let oportunidadId: string | undefined;

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
      ciudad: lead.ciudad,
      pais: lead.pais,
      web: lead.web,
      // Todos opcionales desde el 07/09/2026. Se traduce solo lo que venga:
      // indexar con undefined revienta, y mandar la cadena "undefined" a GHL
      // sería peor, porque el campo es un desplegable y GHL descarta en
      // silencio cualquier etiqueta que no reconozca.
      fuente: lead.fuente ? ETIQUETA_FUENTE[lead.fuente] : undefined,
      idioma: lead.idioma ? ETIQUETA_IDIOMA[lead.idioma] : undefined,
      sector: lead.sector ? ETIQUETA_SECTOR[lead.sector] : undefined,
      empleados: lead.empleados ? ETIQUETA_EMPLEADOS[lead.empleados] : undefined,
      facturacion: lead.facturacion ? ETIQUETA_FACTURACION[lead.facturacion] : undefined,
      herramientas: lead.herramientas,
    });
    contactoId = contacto.id;

    // En un reintento el upsert ya encuentra el contacto que creó el primer
    // intento y dice `nuevo: false`. Lo que cuenta es lo que pasó la primera vez.
    const contactoExistia =
      previo?.ghl_contacto_id === contacto.id && previo.contacto_existia !== null
        ? previo.contacto_existia
        : !contacto.nuevo;
    await anotar({ ghl_contacto_id: contacto.id, contacto_existia: contactoExistia });

    if (oportunidadPrevia) {
      oportunidadId = oportunidadPrevia;
      if (previo?.ghl_contacto_id && previo.ghl_contacto_id !== contacto.id) {
        console.warn("[leads] reintento con otro contacto; la oportunidad reutilizada sigue en el anterior", {
          uuid: lead.uuid,
          contactoAnterior: previo.ghl_contacto_id,
          contactoNuevo: contacto.id,
        });
      }
    } else {
      const oportunidad = await crearOportunidad(
        {
          empresa: lead.empresa,
          linea: definicion.linea,
          rolJV: definicion.rolJV,
          spinoffId: spinoffGhlId ?? undefined,
          spinoffNombre: spinoffNombre ?? undefined,
          // La clave interna, no el nombre: es lo unico que casa con las
          // opciones del campo «Spin-off» de GHL.
          spinoffClave: lead.spinoffClave ?? undefined,
          // Propietario segun quien haya iniciado sesion. Si el email no esta
          // en el mapa, sale undefined y la oportunidad se crea sin asignar.
          propietarioId: usuarioGhlPorEmail(user.email),
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
      oportunidadId = oportunidad.id;
      await anotar({ ghl_oportunidad_id: oportunidad.id });
    }

    // Sigue siendo bloqueante: sin la asociación la oportunidad JV no aparece
    // en el panel de su spin-off, y un «creado» lo escondería. Pero ya no
    // duplica: el reintento reutiliza la oportunidad anotada y solo repite
    // esto. Si la asociación ya existía, se da por hecha.
    const oportunidadVinculable = oportunidadId;
    if (spinoffGhlId) {
      try {
        await vincularSpinoff(spinoffGhlId, oportunidadVinculable);
      } catch (e) {
        if (!(oportunidadPrevia && esRelacionRepetida(e))) throw e;
        console.warn("[leads] la spin-off ya estaba vinculada", { uuid: lead.uuid, oportunidadId });
      }
    }

    // La nota es contexto para el equipo, no el lead. Si falla, el lead está
    // igual de creado; tumbar el alta por ella provocaba un reintento que
    // volvía a escribir todo lo demás.
    try {
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
    } catch (e) {
      console.error("[leads] la nota en GHL falló; el lead sigue adelante", {
        uuid: lead.uuid,
        detalle: e instanceof GhlError ? `${e.message} · ${JSON.stringify(e.body)}` : String(e),
      });
    }

    await cerrar("creado", {
      ghl_contacto_id: contacto.id,
      ghl_oportunidad_id: oportunidadId,
      contacto_existia: contactoExistia,
      // Quita la marca de reserva: en un lead creado no hay nada que contar.
      detalle: null,
    });

    // El borrador ya cumplió: el lead existe. Se borra por `uuid`, que es el
    // mismo que generó el formulario, así que no hace falta arrastrar ningún
    // identificador extra en el cuerpo del POST. Si no había borrador —el
    // caso normal, un alta de una sentada— esto no afecta a ninguna fila.
    const { error: errorBorrador } = await supabase
      .from("leads_borrador").delete().eq("uuid", lead.uuid);
    if (errorBorrador) console.error("[leads] borrado del borrador falló", errorBorrador);

    return NextResponse.json({
      contactoId: contacto.id,
      oportunidadId,
      contactoExistia,
      leadId: filaId,
      precio: calculo.presentado,
      estado: calculo.estado,
      avisos: calculo.avisos,
    });
  } catch (error) {
    const detalle =
      error instanceof GhlError
        ? `${error.message} · ${JSON.stringify(error.body)}`
        : error instanceof Error
          ? error.message
          : "Error desconocido";
    // Sin esto, un rechazo de GHL no deja rastro en el log del servidor.
    console.error("[leads] escritura en GHL falló", { uuid: lead.uuid, detalle });
    // Los ids viajan también aquí, además de en `anotar`: si aquella escritura
    // falló, este es el segundo intento de que el reintento los encuentre.
    await cerrar("error", {
      detalle,
      ...(contactoId ? { ghl_contacto_id: contactoId } : {}),
      ...(oportunidadId ? { ghl_oportunidad_id: oportunidadId } : {}),
    });
    return NextResponse.json(
      { error: "No se pudo guardar en GHL. Revisa el detalle del lead." },
      { status: 502 },
    );
  }
}
