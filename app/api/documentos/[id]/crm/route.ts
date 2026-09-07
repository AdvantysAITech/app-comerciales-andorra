/**
 * Reintento de la subida al CRM.  →  app/api/documentos/[id]/crm/route.ts
 *
 * Sirve para un caso y solo uno: la propuesta está validada, la subida falló
 * —GHL caído, token caducado, lo que sea— y hay que volver a intentarlo sin
 * tocar el documento. No valida, no edita, no recalcula: sube lo que hay.
 *
 * Desde el 07/09/2026 exige que la versión actual esté validada. Antes se podía
 * reintentar cualquier cosa, que en el modelo nuevo sería la puerta trasera:
 * editar el precio y darle a «Reintentar» para colar la versión sin revisar.
 *
 * Quién puede: el mismo criterio que para editar (dueño, o alcance equipo o
 * total sobre `captacion`), y se comprueba con la RLS. Un comercial reintenta
 * su propia propuesta ya validada, que es reenviar exactamente lo que otro
 * aprobó.
 */
import { NextResponse } from "next/server";
import { getSupabaseRoute } from "@/lib/supabase/route-auth";
import { publicarEnCrm, versionValidada } from "@/lib/documentos/publicar";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await getSupabaseRoute();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sesión caducada" }, { status: 401 });
  }

  const { data: doc } = await supabase
    .from("documentos")
    .select("id, ediciones, validado_en, validado_version")
    .eq("id", id)
    .maybeSingle();

  if (!doc) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  if (!versionValidada(doc)) {
    return NextResponse.json(
      {
        error:
          "Esta versión todavía no está validada. Al CRM solo sube lo que ha pasado revisión.",
      },
      { status: 409 },
    );
  }

  // Limpiar el error es lo primero que hay que hacer de todas formas, y de
  // paso sirve de control de permiso: pasa por `documentos_update`, así que si
  // este usuario no puede tocar el documento no vuelve ninguna fila.
  const { data: permitido } = await supabase
    .from("documentos")
    .update({ ghl_error: null })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (!permitido) {
    return NextResponse.json(
      { error: "No tienes permiso para modificar esta propuesta." },
      { status: 403 },
    );
  }

  const crm = await publicarEnCrm({ documentoId: id, baseUrl: request.url });

  return NextResponse.json({ ok: crm.error === null, crm }, { status: crm.error ? 502 : 200 });
}