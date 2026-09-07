/**
 * Validar una propuesta.  →  app/documentos/[id]/validar/route.ts
 *
 * OJO con la ruta del fichero. Vive bajo `app/documentos/[id]/`, así que la URL
 * es `/documentos/:id/validar`, NO `/api/documentos/:id/validar`. El botón
 * apuntaba a la segunda, que no existe, y por eso la validación no ha
 * funcionado nunca desde la interfaz.
 *
 * Desde el 07/09/2026 esto hace dos cosas, no una:
 *
 *   1. Marca validada la VERSIÓN actual. No el documento: la versión. Si
 *      después alguien edita, `ediciones` sube y `validado_version` se queda
 *      donde estaba, así que la nueva versión nace sin validar. La validación
 *      anterior no se toca ni se revoca nunca.
 *   2. Sube el PDF a la oportunidad. Validar es la única puerta al CRM: ni
 *      generar, ni editar, ni descargar mandan nada a GHL.
 *
 * Se trabaja con la service_role key a propósito. El permiso se comprueba aquí
 * arriba con `sesionActual()`, y hacerlo además con la RLS mezclaba dos
 * módulos distintos: esta ruta miraba el alcance de `documentos` y la política
 * `documentos_update` mira el de `captacion`. Quien tuviera uno y no el otro
 * pasaba el guardián y se comía un UPDATE de cero filas sin error, con la
 * pantalla diciéndole que había validado.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sesionActual } from "@/lib/permisos";
import { publicarEnCrm, versionDe, versionValidada } from "@/lib/documentos/publicar";

// Puede tener que regenerar el PDF, y react-pdf necesita Node.
export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const sesion = await sesionActual();
  const alcance = sesion?.alcances.documentos;

  // Decisión del 07/09: validan `total` y `equipo`. `propio` no: un comercial
  // no se firma sus propias propuestas.
  if (!sesion || (alcance !== "total" && alcance !== "equipo")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: doc } = await admin
    .from("documentos")
    .select("id, ediciones, validado_en, validado_version")
    .eq("id", id)
    .maybeSingle();

  if (!doc) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const version = versionDe(doc.ediciones);

  // Ya validada esta misma versión: no se vuelve a escribir `validado_en`
  // —falsearía la fecha— pero sí se reintenta la subida, que es lo único que
  // puede haber fallado si alguien vuelve a darle al botón.
  if (versionValidada(doc)) {
    const crm = await publicarEnCrm({ documentoId: id, baseUrl: request.url });
    return NextResponse.json({ ok: true, version, yaEstaba: true, crm });
  }

  const { error } = await admin
    .from("documentos")
    .update({
      validado_por: sesion.usuario.id,
      validado_en: new Date().toISOString(),
      validado_version: version,
    })
    .eq("id", id);

  if (error) {
    console.error("[validar] no se pudo marcar como validada", error);
    return NextResponse.json({ error: "No se pudo validar el documento." }, { status: 500 });
  }

  // La subida es «best effort», igual que antes: si GHL está caído, la
  // propuesta se queda validada y el error queda en `ghl_error` con el botón
  // de reintentar a mano. Perder la conexión con el CRM no puede deshacer una
  // decisión que ya se ha tomado.
  const crm = await publicarEnCrm({ documentoId: id, baseUrl: request.url });

  return NextResponse.json({ ok: true, version, yaEstaba: false, crm });
}