import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { sesionActual } from "@/lib/permisos";
import {
  bantSchema,
  FUENTES,
  IDIOMAS,
  SECTORES,
  EMPLEADOS,
  FACTURACION,
  ETIQUETA_FUENTE,
  ETIQUETA_IDIOMA,
  ETIQUETA_SECTOR,
  ETIQUETA_EMPLEADOS,
  ETIQUETA_FACTURACION,
  ETIQUETA_PROCESO,
  PROCESOS,
} from "@/lib/domain/lead";
import { calcularBant } from "@/lib/domain/bant";
import type { LineaNegocio, RolJV } from "@/lib/domain/tipos";
import type { Servicio } from "@/lib/domain/servicio";
import {
  actualizarContacto,
  actualizarOportunidad,
  borrarContacto,
  borrarOportunidad,
  cuentaOportunidades,
} from "@/lib/ghl/mantenimiento";

export const runtime = "nodejs";

/**
 * Lo editable de un lead ya guardado.
 *
 * La ruta, la spin-off y el rol NO están: determinan el pipeline de GHL, y
 * GHL no mueve oportunidades entre pipelines. Cambiarlas sería borrar y
 * recrear, con id nuevo y el historial de la oportunidad perdido. Un lead mal
 * clasificado se borra y se da de alta otra vez.
 */
const edicionSchema = z.object({
  nombre: z.string().trim().min(2, "Escribe nombre y apellidos"),
  email: z.string().trim().email("Revisa el email"),
  telefono: z.string().trim().min(6, "Incluye el prefijo internacional"),
  empresa: z.string().trim().min(2, "Falta la razón social"),
  cargo: z.string().trim().optional(),
  ciudadPais: z.string().trim().min(2, "Indica ciudad y país"),
  web: z
    .union([z.string().trim().url("La web tiene que empezar por https://"), z.literal("")])
    .optional(),
  fuente: z.enum(FUENTES),
  idioma: z.enum(IDIOMAS),
  sector: z.enum(SECTORES),
  empleados: z.enum(EMPLEADOS),
  facturacion: z.enum(FACTURACION),
  herramientas: z.string().trim().optional(),
  notas: z.string().trim().optional(),
  valorEstimado: z.number().nonnegative().optional(),
  procesos: z.array(z.enum(PROCESOS)).default([]),
  bant: bantSchema.default({}),
});

/**
 * Forma de la fila que se lee de `leads`.
 *
 * Se declara aquí y se consulta con `select("*")` en vez de enumerar columnas:
 * el cliente de Supabase solo deduce el tipo de un select cuando la cadena es
 * un literal, y una lista de columnas partida en dos líneas deja de serlo —
 * `data` se queda sin propiedades y falla cada acceso. Mismo patrón que
 * app/(app)/leads/page.tsx.
 */
type FilaLead = {
  id: string;
  comercial_id: string;
  resultado: "en_curso" | "creado" | "bloqueado_wf16" | "error";
  ghl_contacto_id: string | null;
  ghl_oportunidad_id: string | null;
  contacto_existia: boolean | null;
  linea_negocio: LineaNegocio;
  rol_jv: RolJV | null;
  spinoff_nombre: string | null;
  servicio: Servicio | null;
  ruta: string | null;
  checklist: Record<string, unknown> | null;
};

/* ================================================================== */
/* PATCH — corregir                                                    */
/* ================================================================== */

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "Sesión caducada" }, { status: 401 });

  const parsed = edicionSchema.safeParse(await request.json());
  if (!parsed.success) {
    const errores: Record<string, string> = {};
    for (const issue of parsed.error.issues) errores[String(issue.path[0])] = issue.message;
    return NextResponse.json({ error: "Revisa los campos marcados", errores }, { status: 422 });
  }

  const d = parsed.data;
  const supabase = await supabaseServer();

  // La RLS decide de verdad quién puede tocar qué. Este select ya filtra: si
  // el lead no es suyo y no tiene alcance, no vuelve nada.
  const { data, error: errorLead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (errorLead) {
    console.error("[lead:patch] select falló", errorLead);
    return NextResponse.json({ error: `No se pudo leer el lead: ${errorLead.message}` }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });

  const lead = data as FilaLead;
  const bant = calcularBant(d.bant);

  /* --- 1. Supabase primero ---------------------------------------- */

  // Se escribe aquí antes que en GHL a propósito: si GHL falla, la corrección
  // no se pierde y se puede reintentar. Al revés, un fallo intermedio dejaría
  // el CRM corregido y la app con los datos viejos, que es peor de detectar.
  const { error: errorUpdate } = await supabase
    .from("leads")
    .update({
      nombre: d.nombre,
      email: d.email,
      telefono: d.telefono,
      empresa: d.empresa,
      cargo: d.cargo ?? null,
      ciudad_pais: d.ciudadPais,
      web: d.web || null,
      fuente: d.fuente,
      idioma: d.idioma,
      sector: d.sector,
      empleados: d.empleados,
      facturacion: d.facturacion,
      herramientas: d.herramientas ?? null,
      notas: d.notas ?? null,
      procesos: d.procesos,
      bant: d.bant,
      bant_score: bant.respondidas > 0 ? bant.total : null,
      bant_clasificacion: bant.respondidas > 0 ? bant.clasificacion : null,
      bant_completo: bant.completo,
      modificado_en: new Date().toISOString(),
      modificado_por: sesion.usuario.id,
    })
    .eq("id", id);

  if (errorUpdate) {
    console.error("[lead:patch] update falló", errorUpdate);
    return NextResponse.json(
      { error: `No se pudo guardar el cambio: ${errorUpdate.message}` },
      { status: 500 },
    );
  }

  /* --- 2. GHL ------------------------------------------------------ */

  // El pain declarado es la respuesta larga del checklist: la de contexto del
  // cliente. No se guarda con nombre propio, así que se localiza por longitud.
  const pain = (() => {
    const valor = Object.values(lead.checklist ?? {}).find(
      (v) => typeof v === "string" && v.length > 40,
    );
    return typeof valor === "string" ? valor : undefined;
  })();

  try {
    if (lead.ghl_contacto_id) {
      await actualizarContacto(lead.ghl_contacto_id, {
        nombre: d.nombre,
        email: d.email,
        telefono: d.telefono,
        empresa: d.empresa,
        cargo: d.cargo,
        ciudadPais: d.ciudadPais,
        web: d.web,
        fuente: ETIQUETA_FUENTE[d.fuente],
        idioma: ETIQUETA_IDIOMA[d.idioma],
        sector: ETIQUETA_SECTOR[d.sector],
        empleados: ETIQUETA_EMPLEADOS[d.empleados],
        facturacion: ETIQUETA_FACTURACION[d.facturacion],
        herramientas: d.herramientas,
      });
    }

    if (lead.ghl_oportunidad_id) {
      await actualizarOportunidad(lead.ghl_oportunidad_id, {
        empresa: d.empresa,
        linea: lead.linea_negocio,
        rolJV: lead.rol_jv ?? undefined,
        spinoffNombre: lead.spinoff_nombre ?? undefined,
        servicio: lead.servicio ?? undefined,
        valorEstimado: d.valorEstimado,
        pain,
        procesos: d.procesos.map((p) => ETIQUETA_PROCESO[p]),
        bant: d.bant,
      });
    }
  } catch (error) {
    const detalle = error instanceof Error ? error.message : "Error desconocido";
    console.error("[lead:patch] GHL falló", detalle);

    // El cambio está guardado en la app; solo el CRM se ha quedado atrás.
    // Se dice tal cual en vez de fingir un fallo total.
    return NextResponse.json(
      {
        error:
          `El cambio se ha guardado en la app, pero no se pudo actualizar el ` +
          `Sistema Advantys. ${detalle}`,
        parcial: true,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, bantScore: bant.respondidas > 0 ? bant.total : null });
}

/* ================================================================== */
/* DELETE — borrar                                                     */
/* ================================================================== */

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "Sesión caducada" }, { status: 401 });

  const supabase = await supabaseServer();

  const { data } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!data) return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });

  const lead = data as FilaLead;

  const borrado = { oportunidad: false, contacto: false, motivoContacto: "" };

  /* --- 1. GHL primero ---------------------------------------------- */

  // Aquí el orden se invierte respecto al PATCH: si se borrase primero la fila
  // de Supabase y GHL fallara, quedaría una oportunidad huérfana en el CRM sin
  // nada en la app que apunte a ella. Imposible de encontrar salvo a mano.
  try {
    if (lead.ghl_oportunidad_id) {
      await borrarOportunidad(lead.ghl_oportunidad_id);
      borrado.oportunidad = true;
    }

    /**
     * El contacto solo se borra si lo creó esta app y no le queda ninguna otra
     * oportunidad.
     *
     * Un contacto puede venir de antes, tener negocio abierto en otra línea,
     * notas, conversaciones o una tarjeta NFC vinculada (RF-24). Borrarlo
     * arrastra todo eso y no hay deshacer. Si la comprobación no se puede
     * hacer, no se borra: un fallo de red no destruye un contacto.
     */
    if (lead.ghl_contacto_id) {
      if (lead.contacto_existia) {
        borrado.motivoContacto = "El contacto ya existía antes de este lead.";
      } else {
        const restantes = await cuentaOportunidades(lead.ghl_contacto_id);

        if (restantes === null) {
          borrado.motivoContacto =
            "No se pudo comprobar si tiene otras oportunidades, así que se ha dejado.";
        } else if (restantes > 0) {
          borrado.motivoContacto = `Tiene ${restantes} oportunidad(es) más en el CRM.`;
        } else {
          await borrarContacto(lead.ghl_contacto_id);
          borrado.contacto = true;
        }
      }
    }
  } catch (error) {
    const detalle = error instanceof Error ? error.message : "Error desconocido";
    console.error("[lead:delete] GHL falló", detalle);

    return NextResponse.json(
      {
        error:
          `No se pudo borrar en el Sistema Advantys, así que tampoco se ha ` +
          `borrado en la app. ${detalle}`,
      },
      { status: 502 },
    );
  }

  /* --- 2. Supabase ------------------------------------------------- */

  // El documento asociado cae con él por la clave foránea (on delete cascade).
  //
  // `count: "exact"` no es cosmético: cuando la RLS bloquea un delete,
  // PostgREST NO devuelve error, devuelve éxito con cero filas afectadas.
  // Mirando solo `error` se da por borrado algo que sigue ahí, y la lista
  // aparece intacta al recargar sin que nada lo haya avisado.
  const { error: errorDelete, count } = await supabase
    .from("leads")
    .delete({ count: "exact" })
    .eq("id", id);

  if (errorDelete) {
    console.error("[lead:delete] delete falló", errorDelete);
    return NextResponse.json(
      {
        error:
          `Se borró en el Sistema Advantys pero no en la app: ${errorDelete.message}. ` +
          `Avisa a Alex antes de volver a intentarlo.`,
      },
      { status: 500 },
    );
  }

  if (!count) {
    console.error("[lead:delete] delete afectó a 0 filas", { id, usuario: sesion.usuario.id });
    return NextResponse.json(
      {
        error:
          "Se borró en el Sistema Advantys pero la app no ha borrado ninguna fila. " +
          "Suele ser que falta la política leads_delete en Supabase: ejecuta la " +
          "migración 2026-08-24-editar-borrar-leads.sql.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, ...borrado });
}