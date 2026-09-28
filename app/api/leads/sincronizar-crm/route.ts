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

// La sincronización deja de preguntar a GHL a los 30 s (ver `LIMITE_TOTAL_MS`
// en lib/leads/sincronizar-crm.ts). El resto del margen es para la última
// llamada en curso y las escrituras.
export const maxDuration = 60;

/** Tope de ids confirmados. El botón manda como mucho los que devolvió una
 *  pasada, que lee 200 leads; lo demás es un cuerpo que no viene del botón. */
const MAX_CONFIRMADOS = 500;

export async function POST(request: Request) {
  // Sin secreto configurado no hay cron que valga. Si no se comprueba, la
  // cabecera `Bearer undefined` coincidiría con la plantilla y cualquiera
  // entraría como cron, sin sesión.
  const secreto = process.env.CRON_SECRET;
  const esCron =
    !!secreto && request.headers.get("authorization") === `Bearer ${secreto}`;

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

  // `forzar` salta el freno tras confirmarlo una persona desde el botón, y
  // SOLO para los ids que esa persona tenía en pantalla (`ids`). Solo se
  // acepta con sesión: el cron no confirma nada, y si GHL empieza a devolver
  // 404 de madrugada, el freno tiene que actuar.
  let forzar = false;
  let confirmados: string[] = [];
  if (!esCron) {
    const cuerpo = (await request.json().catch(() => null)) as
      | { forzar?: unknown; ids?: unknown }
      | null;
    forzar = cuerpo?.forzar === true;

    if (forzar) {
      const ids = cuerpo?.ids;
      const valido =
        Array.isArray(ids) &&
        ids.length > 0 &&
        ids.length <= MAX_CONFIRMADOS &&
        ids.every((id) => typeof id === "string" && id.length > 0 && id.length <= 64);
      if (!valido) {
        return NextResponse.json(
          { error: "Confirmación sin lista de leads válida. Vuelve a comprobar." },
          { status: 400 },
        );
      }
      confirmados = ids as string[];
    }
  }

  try {
    const resultado = await sincronizarLeadsConCrm({ forzar, confirmados });
    if (forzar) {
      console.warn(
        `[sync-leads] freno saltado con confirmación manual para ${confirmados.length} leads`,
      );
    }

    if (resultado.abortado) {
      console.error("[sync-leads] ejecución abortada", resultado.abortado);
    } else {
      console.log(
        `[sync-leads] ${resultado.comprobados} comprobados · ` +
          `${resultado.eliminados} marcados como borrados · ` +
          `${resultado.omitidos} omitidos · ` +
          `${resultado.aplazados} aplazados por tiempo · ` +
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