import { NextResponse } from "next/server";
import { sincronizarSpinoffs } from "@/lib/ghl/spinoffs";
import { getUsuarioSesion } from "@/lib/supabase/route-auth";

/** Refresco de la caché. Dos entradas: un usuario con sesión (botón manual)
 *  o el cron de Vercel con su cabecera de autorización. */
export async function POST(request: Request) {
  // Sin secreto configurado no hay cron que valga: si no, `Bearer undefined`
  // coincidiría con la plantilla y entraría cualquiera sin sesión.
  const secreto = process.env.CRON_SECRET;
  const esCron =
    !!secreto && request.headers.get("authorization") === `Bearer ${secreto}`;

  if (!esCron && !(await getUsuarioSesion())) {
    return NextResponse.json({ error: "Sesión caducada" }, { status: 401 });
  }

  try {
    const resultado = await sincronizarSpinoffs();
    return NextResponse.json(resultado);
  } catch (error) {
    const detalle = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: detalle }, { status: 502 });
  }
}

/**
 * El cron de Vercel dispara con GET.
 *
 * Mismo motivo que en `/api/leads/sincronizar-crm`: con `export const GET =
 * POST` Next 16 no registra el método y la ruta contesta 405. Esta ruta lo
 * tuvo así desde el principio, así que el refresco diario de la caché de
 * spin-offs no llegó a ejecutarse nunca.
 */
export async function GET(request: Request) {
  return POST(request);
}