import { NextResponse } from "next/server";
import { sincronizarSpinoffs } from "@/lib/ghl/spinoffs";
import { getUsuarioSesion } from "@/lib/supabase/route-auth";

/** Refresco de la caché. Dos entradas: un usuario con sesión (botón manual)
 *  o el cron de Vercel con su cabecera de autorización. */
export async function POST(request: Request) {
  const esCron =
    request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;

  if (!esCron && !(await getUsuarioSesion())) {
    return NextResponse.json({ error: "Sesión caducada" }, { status: 401 });
  }

  try {
    const total = await sincronizarSpinoffs();
    return NextResponse.json({ sincronizadas: total });
  } catch (error) {
    const detalle = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: detalle }, { status: 502 });
  }
}

// El cron de Vercel dispara con GET.
export const GET = POST;