import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { sesionActual } from "@/lib/permisos";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Validar es lo que desbloquea la descarga para el cliente. Solo alcance
  // total, y comprobado en servidor: el botón de la pantalla no protege nada.
  const sesion = await sesionActual();
  if (!sesion || sesion.alcances.documentos !== "total") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const supabase = await supabaseServer();

  // La RLS de `documentos` no tiene política de UPDATE, así que este write
  // necesita el cliente admin. Se hace con el id ya comprobado arriba.
  const { error } = await supabase
    .from("documentos")
    .update({ validado_por: sesion.usuario.id, validado_en: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "No se pudo validar el documento." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}