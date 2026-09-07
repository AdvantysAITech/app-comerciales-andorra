/**
 * Borradores de alta de lead.
 *
 * POST   guarda o actualiza el borrador y crea el contacto en GHL.
 * DELETE lo descarta.
 *
 * El orden importa: primero se guarda en Supabase, después se va a GHL. Al
 * revés, un fallo de red dejaría un contacto creado en el CRM y ningún
 * borrador que lo continúe, que es la peor de las dos mitades.
 *
 * La escritura en GHL es «best effort». Si falla, el borrador sigue guardado
 * y el motivo queda en `ghl_error`: el comercial no puede perder lo que
 * acaba de teclear porque GoHighLevel esté caído. Al completar el formulario,
 * `upsertContacto` vuelve a intentarlo de todas formas.
 */
import { NextResponse } from "next/server";
import { getSupabaseRoute } from "@/lib/supabase/route-auth";
import { borradorSchema } from "@/lib/domain/lead";
import { upsertContacto } from "@/lib/ghl/contactos";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await getSupabaseRoute();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sesión caducada" }, { status: 401 });
  }

  let bruto: unknown;
  try {
    bruto = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo no válido" }, { status: 400 });
  }

  const parsed = borradorSchema.safeParse(bruto);
  if (!parsed.success) {
    const errores: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const clave = String(issue.path[0]);
      if (!errores[clave]) errores[clave] = issue.message;
    }
    return NextResponse.json(
      { error: "Faltan datos para guardar el borrador.", errores },
      { status: 422 },
    );
  }

  const b = parsed.data;

  /* --- 1. Supabase --------------------------------------------------- */

  const { error: errorGuardado } = await supabase.from("leads_borrador").upsert(
    {
      uuid: b.uuid,
      comercial_id: user.id,
      comercial_email: user.email,
      nombre: b.nombre,
      email: b.email,
      telefono: b.telefono,
      empresa: b.empresa,
      estado: b.estado,
      actualizado_en: new Date().toISOString(),
    },
    { onConflict: "uuid" },
  );

  if (errorGuardado) {
    console.error("[borrador] no se pudo guardar", errorGuardado);
    return NextResponse.json(
      { error: "No se pudo guardar el borrador." },
      { status: 500 },
    );
  }

  /* --- 2. Contacto en GHL -------------------------------------------- */

  // Solo el contacto. La oportunidad se crea al completar el formulario: sin
  // ruta, sin BANT y sin precio no hay nada que meter en un pipeline, y los
  // workflows la tratarían como un lead cualificado.
  try {
    const contacto = await upsertContacto({
      nombre: b.nombre,
      email: b.email,
      telefono: b.telefono,
      empresa: b.empresa,
    });

    await supabase
      .from("leads_borrador")
      .update({ ghl_contacto_id: contacto.id, ghl_error: null })
      .eq("uuid", b.uuid);

    return NextResponse.json({ ok: true, ghl: { contactoId: contacto.id, error: null } });
  } catch (e) {
    const detalle = e instanceof Error ? e.message : "Error desconocido";
    console.error("[borrador] contacto en GHL falló", detalle);

    const aviso = `Guardado, pero el contacto no se ha creado en el CRM: ${detalle}`;
    await supabase.from("leads_borrador").update({ ghl_error: aviso }).eq("uuid", b.uuid);

    return NextResponse.json({ ok: true, ghl: { contactoId: null, error: aviso } });
  }
}

export async function DELETE(request: Request) {
  const supabase = await getSupabaseRoute();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sesión caducada" }, { status: 401 });
  }

  const uuid = new URL(request.url).searchParams.get("uuid");
  if (!uuid) {
    return NextResponse.json({ error: "Falta el identificador" }, { status: 400 });
  }

  // La RLS de DELETE solo deja borrar lo propio, así que no hace falta
  // comprobar el dueño aquí: si no es suyo, no borra ninguna fila.
  const { error } = await supabase.from("leads_borrador").delete().eq("uuid", uuid);

  if (error) {
    console.error("[borrador] no se pudo descartar", error);
    return NextResponse.json({ error: "No se pudo descartar el borrador." }, { status: 500 });
  }

  // El contacto que se creó en GHL NO se borra. Es un contacto real, con
  // nombre y teléfono de alguien con quien se habló: descartar el formulario
  // no es motivo para tirarlo del CRM.
  return NextResponse.json({ ok: true });
}