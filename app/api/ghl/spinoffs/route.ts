import { NextResponse } from "next/server";
import { listarSpinoffs } from "@/lib/ghl/spinoffs";
import { usuarioActual } from "@/lib/supabase/server";

export async function GET() {
  if (!(await usuarioActual())) {
    return NextResponse.json({ error: "Sesión caducada" }, { status: 401 });
  }

  try {
    return NextResponse.json({ spinoffs: await listarSpinoffs() });
  } catch {
    return NextResponse.json(
      { error: "No se pudo leer el listado de spin-offs desde GHL" },
      { status: 502 },
    );
  }
}