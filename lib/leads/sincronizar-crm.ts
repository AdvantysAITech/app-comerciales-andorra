/**
 * Comprobación diaria: ¿siguen existiendo estos leads en el CRM?
 *
 * Se pregunta uno a uno por la oportunidad —o por el contacto, si el lead no
 * llegó a tener oportunidad— y se marca `eliminado_en` en los que ya no están.
 * La fila no se borra nunca: `leads` es el registro de auditoría de la
 * captación, y perder la fila sería perder también quién dio de alta qué y
 * cuándo.
 *
 * ── Qué significa cada respuesta ─────────────────────────────────────────
 *
 *   404  → el registro no existe. Esto, y solo esto, marca el lead.
 *   401  → credenciales. NO es un borrado: es el token caducado o sin scope,
 *          que es justamente lo que pasó el 07/09/2026. Aborta la ejecución
 *          entera sin escribir nada. Si esto marcara leads, una caducidad de
 *          token a las seis de la mañana vaciaría la lista de todo el equipo
 *          sin que nadie lo viera hasta abrir la app.
 *   403  → igual que el 401. Permisos, no ausencia.
 *   429  → límite de ráfaga. `ghl()` ya reintenta una vez; si vuelve, se deja
 *          el lead para mañana.
 *   5xx  → GHL caído. Se deja para mañana.
 *   red  → sin respuesta. Se deja para mañana.
 *
 * Ante la duda, NO marcar. Un lead borrado que tarda un día más en
 * desaparecer de la lista es una molestia; un lead vivo marcado como borrado
 * es trabajo comercial que se evapora de la pantalla.
 *
 * ── El freno ─────────────────────────────────────────────────────────────
 *
 * Si en una pasada más de `UMBRAL_ABORTO` de los leads ACTIVOS comprobados
 * sale 404 por primera vez, no se marca ninguno. Que se borre de golpe un
 * tercio de la cartera es improbable; que GHL cambie el comportamiento de un
 * endpoint y empiece a devolver 404 donde antes devolvía otra cosa, no tanto.
 * El freno convierte ese día malo en un aviso en vez de en una pérdida de
 * datos.
 *
 * Tres reglas del freno, aprendidas el 28/09/2026 (9 de 12 leads de prueba
 * borrados en GHL y el botón bloqueado sin salida):
 *
 *  1. Solo cuentan los 404 NUEVOS sobre leads activos. Un lead ya marcado que
 *     sigue dando 404 no es noticia: si contara, en una cartera pequeña con
 *     leads de prueba borrados el freno saltaría todos los días para siempre.
 *  2. El freno corta la ESCRITURA sobre `leads`, no la ejecución: los
 *     borradores se comprueban igual. Son otra tabla y otro problema.
 *  3. Una persona puede confirmarlo. Si el freno salta desde el botón, se
 *     devuelve la lista de empresas afectadas y el botón ofrece «Sí, están
 *     borrados». Esa segunda pasada vuelve a preguntar a GHL —no se fía de la
 *     primera— y solo se salta el porcentaje. El cron nunca fuerza.
 */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { ghl, GhlError } from "@/lib/ghl/client";

/** Leads por ejecución. Con el índice de `comprobado_en` la cola rota sola:
 *  los que llevan más tiempo sin mirarse entran primero. */
const POR_EJECUCION = 200;

/** Proporción de 404 a partir de la cual se aborta sin escribir. */
const UMBRAL_ABORTO = 0.3;

/** Por debajo de esto el porcentaje no significa nada: con tres leads, uno
 *  borrado ya es un tercio. El freno solo actúa con volumen suficiente. */
const MINIMO_PARA_FRENO = 10;

/** Pausa entre llamadas. GHL limita por ráfagas y esto no tiene ninguna
 *  prisa: corre de madrugada y nadie lo está esperando. */
const PAUSA_MS = 120;

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Lead que ha dado 404 por primera vez y el freno ha dejado sin marcar. */
export type Pendiente = { id: string; empresa: string | null };

export type ResultadoSync = {
  comprobados: number;
  eliminados: number;
  restaurados: number;
  /** Ni vivos ni borrados: fallos transitorios que se reintentan mañana. */
  omitidos: number;
  /** Desglose por tabla, para saber de dónde salió cada número. */
  borradores: { comprobados: number; eliminados: number };
  /** Motivo por el que se cortó, si se cortó. Null = ejecución completa. */
  abortado: string | null;
  /** True si saltó el freno del porcentaje: los leads no se han marcado,
   *  pero se puede confirmar a mano con `forzar`. */
  frenado: boolean;
  /** Con el freno: los leads que se habrían marcado, para enseñárselos a
   *  quien tenga que confirmarlo. Vacío en cualquier otro caso. */
  pendientes: Pendiente[];
};

type Estado = "vivo" | "no_existe" | "omitido";

/**
 * Pregunta por un registro y traduce la respuesta a uno de tres estados.
 *
 * Lanza —en vez de devolver un estado— cuando el problema es de credenciales.
 * Eso corta el bucle entero desde arriba, que es lo que tiene que pasar: si el
 * token no vale, ninguna respuesta de esta ejecución es interpretable.
 */
async function comprobar(ruta: string): Promise<Estado> {
  try {
    await ghl(ruta);
    return "vivo";
  } catch (e) {
    if (!(e instanceof GhlError)) return "omitido";

    if (e.status === 404) return "no_existe";
    if (e.status === 401 || e.status === 403) {
      throw new Error(
        `GHL respondió ${e.status} al comprobar ${ruta}. Es un problema de ` +
          `credenciales, no un borrado: revisa el token en Ajustes → ` +
          `Integraciones privadas. No se ha marcado ningún lead.`,
      );
    }
    return "omitido";
  }
}

export async function sincronizarLeadsConCrm(
  opciones: { forzar?: boolean } = {},
): Promise<ResultadoSync> {
  const { forzar = false } = opciones;
  const admin = createAdminClient();

  // Solo los que llegaron a existir en GHL. Un lead con `resultado = 'error'`
  // nunca se creó allí, así que preguntar por él daría 404 y lo marcaría como
  // borrado: sería mentir sobre lo que pasó.
  const { data, error } = await admin
    .from("leads")
    .select("id, empresa, ghl_oportunidad_id, ghl_contacto_id, eliminado_en")
    .eq("resultado", "creado")
    .order("comprobado_en", { ascending: true, nullsFirst: true })
    .limit(POR_EJECUCION);

  if (error) throw new Error(`No se pudieron leer los leads: ${error.message}`);

  const leads = data ?? [];
  const ahora = new Date().toISOString();

  const noExisten: string[] = [];
  const vivos: string[] = [];
  let omitidos = 0;

  for (const lead of leads) {
    const ruta = lead.ghl_oportunidad_id
      ? `/opportunities/${lead.ghl_oportunidad_id}`
      : lead.ghl_contacto_id
        ? `/contacts/${lead.ghl_contacto_id}`
        : null;

    // Sin ningún id no hay nada que preguntar. No es un borrado.
    if (!ruta) {
      omitidos++;
      continue;
    }

    let estado: Estado;
    try {
      estado = await comprobar(ruta);
    } catch (e) {
      // Credenciales. Se corta aquí y no se escribe ni una fila.
      return {
        comprobados: vivos.length + noExisten.length,
        eliminados: 0,
        restaurados: 0,
        omitidos,
        borradores: { comprobados: 0, eliminados: 0 },
        abortado: e instanceof Error ? e.message : "Error desconocido",
        frenado: false,
        pendientes: [],
      };
    }

    if (estado === "no_existe") noExisten.push(lead.id);
    else if (estado === "vivo") vivos.push(lead.id);
    else omitidos++;

    await dormir(PAUSA_MS);
  }

  const comprobados = vivos.length + noExisten.length;

  /* --- Freno -------------------------------------------------------- */

  // Se separan los 404 nuevos de los que ya estaban marcados. Solo los nuevos
  // son una novedad que pueda indicar un fallo de GHL, y solo los activos
  // forman la cartera sobre la que se mide el porcentaje.
  const marcadoAntes = new Set(leads.filter((l) => l.eliminado_en !== null).map((l) => l.id));
  const nuevos404 = noExisten.filter((id) => !marcadoAntes.has(id));
  const siguenBorrados = noExisten.filter((id) => marcadoAntes.has(id));
  const activosComprobados = comprobados - siguenBorrados.length;

  const frenado =
    !forzar &&
    activosComprobados >= MINIMO_PARA_FRENO &&
    nuevos404.length / activosComprobados > UMBRAL_ABORTO;

  /* --- Escritura ---------------------------------------------------- */

  if (!frenado && nuevos404.length > 0) {
    await admin
      .from("leads")
      .update({ eliminado_en: ahora, comprobado_en: ahora })
      .in("id", nuevos404);
  }

  // Los que ya estaban marcados y siguen sin existir: solo se apunta que se
  // han mirado, para que la cola rote. La fecha de borrado no se toca.
  if (siguenBorrados.length > 0) {
    await admin.from("leads").update({ comprobado_en: ahora }).in("id", siguenBorrados);
  }

  // Los vivos se marcan como comprobados. Y si alguno estaba marcado como
  // eliminado, se le quita la marca: no debería pasar —los ids de GHL no se
  // reutilizan— pero si una ejecución anterior se equivocó, la siguiente lo
  // corrige sola en vez de dejarlo enterrado para siempre. Esto se hace
  // también con el freno puesto: quitar una marca nunca hace daño.
  const restaurados = vivos.filter((id) => marcadoAntes.has(id)).length;

  if (vivos.length > 0) {
    await admin
      .from("leads")
      .update({ eliminado_en: null, comprobado_en: ahora })
      .in("id", vivos);
  }

  const pendientes: Pendiente[] = frenado
    ? leads
        .filter((l) => nuevos404.includes(l.id))
        .map((l) => ({ id: l.id, empresa: l.empresa ?? null }))
    : [];

  const avisoFreno = frenado
    ? `${nuevos404.length} de ${activosComprobados} leads activos han devuelto 404, ` +
      `más del ${Math.round(UMBRAL_ABORTO * 100)}% permitido, así que no se ha ` +
      `marcado ninguno por precaución. Si los has borrado tú en el CRM, confírmalo ` +
      `y se marcarán.`
    : null;

  /* --- Borradores ---------------------------------------------------- */

  // Se hace al final y aparte porque un borrador NO es un lead: no tiene
  // oportunidad, solo contacto, y su fila no es auditoría de nada. Pero el
  // problema es el mismo —si el contacto se borra en GHL, el borrador se
  // queda para siempre en «Sin terminar»— y la regla también: solo el 404.
  const borradores = await sincronizarBorradores();

  return {
    comprobados: comprobados + borradores.comprobados,
    eliminados: (frenado ? 0 : nuevos404.length) + borradores.eliminados,
    restaurados,
    omitidos: omitidos + borradores.omitidos,
    borradores: { comprobados: borradores.comprobados, eliminados: borradores.eliminados },
    // Credenciales manda sobre el freno: si el token falló en los
    // borradores, eso es lo primero que hay que arreglar.
    abortado: borradores.abortado ?? avisoFreno,
    // Con un fallo de credenciales no se ofrece confirmar: esa pasada
    // forzada también fallaría.
    frenado: frenado && !borradores.abortado,
    pendientes: borradores.abortado ? [] : pendientes,
  };
}

/**
 * Lo mismo para los borradores, preguntando por el contacto.
 *
 * Sin freno de porcentaje: aquí no hay riesgo equivalente. Un borrador
 * marcado por error no destruye nada —el contacto sigue en GHL y el lead
 * nunca llegó a existir— y basta con quitar la fecha para recuperarlo. El
 * corte por credenciales sí se mantiene, que es el que importa.
 */
async function sincronizarBorradores(): Promise<{
  comprobados: number;
  eliminados: number;
  omitidos: number;
  abortado: string | null;
}> {
  const admin = createAdminClient();
  const ahora = new Date().toISOString();

  const { data } = await admin
    .from("leads_borrador")
    .select("uuid, ghl_contacto_id")
    .is("eliminado_en", null)
    .not("ghl_contacto_id", "is", null)
    .limit(POR_EJECUCION);

  const filas = data ?? [];

  const noExisten: string[] = [];
  const vivos: string[] = [];
  let omitidos = 0;

  for (const fila of filas) {
    let estado: Estado;
    try {
      estado = await comprobar(`/contacts/${fila.ghl_contacto_id}`);
    } catch (e) {
      return {
        comprobados: vivos.length + noExisten.length,
        eliminados: 0,
        omitidos,
        abortado: e instanceof Error ? e.message : "Error desconocido",
      };
    }

    if (estado === "no_existe") noExisten.push(fila.uuid);
    else if (estado === "vivo") vivos.push(fila.uuid);
    else omitidos++;

    await dormir(PAUSA_MS);
  }

  if (noExisten.length > 0) {
    await admin
      .from("leads_borrador")
      .update({ eliminado_en: ahora, comprobado_en: ahora })
      .in("uuid", noExisten);
  }

  if (vivos.length > 0) {
    await admin.from("leads_borrador").update({ comprobado_en: ahora }).in("uuid", vivos);
  }

  return {
    comprobados: vivos.length + noExisten.length,
    eliminados: noExisten.length,
    omitidos,
    abortado: null,
  };
}