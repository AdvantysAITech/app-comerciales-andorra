/**
 * Sincronización de leads con el CRM.
 *
 * Dos entradas, igual que la de spin-offs: el cron de Vercel con su cabecera
 * de autorización, o un usuario con sesión para el botón «Actualizar desde
 * CRM».
 *
 * Devuelve 200 aunque la ejecución se haya abortado: abortar es el
 * comportamiento correcto ante un token caducado o un 404 masivo, no un fallo
 * del endpoint. El motivo va en `abortado`, y ahí es donde hay que mirar.
 */
import { NextResponse } from "next/server";
import { sincronizarLeadsConCrm } from "@/lib/leads/sincronizar-crm";
import { sesionActual } from "@/lib/permisos";

export const runtime = "nodejs";

// Doscientas llamadas con pausa de 120 ms son unos 25 segundos. El margen
// cubre las que tarden más de la cuenta.
export const maxDuration = 60;

export async function POST(request: Request) {
  const esCron =
    request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;

  if (!esCron) {
    // A mano solo con alcance sobre los leads de otros: la comprobación
    // recorre la tabla entera y marca lo de todo el equipo. El botón ya se
    // esconde, pero esconder no es proteger.
    const sesion = await sesionActual();
    const alcance = sesion?.alcances.captacion;

    if (!sesion) {
      return NextResponse.json({ error: "Sesión caducada" }, { status: 401 });
    }
    if (alcance !== "total" && alcance !== "equipo") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  try {
    const resultado = await sincronizarLeadsConCrm();

    if (resultado.abortado) {
      console.error("[sync-leads] ejecución abortada", resultado.abortado);
    } else {
      console.log(
        `[sync-leads] ${resultado.comprobados} comprobados · ` +
          `${resultado.eliminados} marcados como borrados · ` +
          `${resultado.omitidos} omitidos · ` +
          `borradores: ${resultado.borradores.comprobados} comprobados, ` +
          `${resultado.borradores.eliminados} marcados`,
      );
    }

    return NextResponse.json(resultado);
  } catch (error) {
    const detalle = error instanceof Error ? error.message : "Error desconocido";
    console.error("[sync-leads] falló", detalle);
    return NextResponse.json({ error: detalle }, { status: 502 });
  }
}

/**
 * El cron de Vercel dispara con GET.
 *
 * Declaración propia, NO `export const GET = POST`. Next 16 detecta los
 * métodos analizando las declaraciones de función exportadas: un `const` que
 * apunta a otro export no se registra, la ruta responde 405 y el cron falla
 * cada madrugada sin que nadie se entere. Cuesta una línea escribirlo bien.
 */
export async function GET(request: Request) {
  return POST(request);
}