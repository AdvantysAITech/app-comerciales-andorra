/**
 * Orquestación: entrada → IA → parseo → control de coherencia → estado.
 */
import "server-only";
import type { Ruta } from "@/lib/domain/rutas";
import type { RespuestasChecklist } from "@/lib/domain/checklists";
import { MODULO_APP_MEDIDA } from "@/lib/domain/checklists";
import { baselineRuta2, baselineX01, comprobarCoherencia, type Coherencia } from "@/lib/precios";
import type { Calculo } from "@/lib/precios";
import { generar, MODELO, type RespuestaIa } from "./cliente";
import { SYSTEM, VERSION_PROMPT, construirPrompt } from "./prompt";
import { horasEstimadas, parsearAlcance, type Alcance } from "./salida";
import type { EntradaIa } from "./entrada";

export type ResultadoGeneracion = {
  alcance: Alcance;
  entrada: EntradaIa;
  /** Trazabilidad (7.7): con qué se generó. */
  traza: {
    modelo: string;
    versionPrompt: string;
    tokensEntrada: number;
    tokensSalida: number;
    salidaCruda: string;
  };
  coherencia: Coherencia | null;
  /** Motivos que obligan a revisión, además de los del cálculo de precio. */
  motivosExtra: string[];
};

export async function generarAlcance(args: {
  ruta: Ruta;
  respuestas: RespuestasChecklist;
  entrada: EntradaIa;
  calculo: Calculo;
}): Promise<ResultadoGeneracion> {
  const respuesta: RespuestaIa = await generar({
    system: SYSTEM,
    prompt: construirPrompt(args.entrada),
  });

  const alcance = parsearAlcance(respuesta.texto);
  const motivosExtra: string[] = [];

  // 7.5 — Control de coherencia. Solo donde la IA estima horas de verdad:
  // rutas 2 y X01. En las demás el precio sale de tabla y comparar no
  // significaría nada.
  let coherencia: Coherencia | null = null;
  const marcados = Array.isArray(args.respuestas["R3.1"])
    ? (args.respuestas["R3.1"] as string[])
    : [];

  const baseline =
    args.ruta === "ruta_2"
      ? baselineRuta2(args.respuestas)
      : marcados.includes(MODULO_APP_MEDIDA)
        ? baselineX01(args.respuestas)
        : null;

  if (baseline !== null) {
    coherencia = comprobarCoherencia(baseline, horasEstimadas(alcance));
    if (!coherencia.aceptable && coherencia.motivo) motivosExtra.push(coherencia.motivo);
  }

  if (alcance.confianza === "baja") {
    motivosExtra.push("La IA ha declarado confianza baja sobre el alcance.");
  }
  if (alcance.avisos.length > 0) {
    motivosExtra.push(...alcance.avisos.map((a) => `Aviso de la IA: ${a}`));
  }

  return {
    alcance,
    entrada: args.entrada,
    traza: {
      modelo: respuesta.modelo || MODELO,
      versionPrompt: VERSION_PROMPT,
      tokensEntrada: respuesta.tokensEntrada,
      tokensSalida: respuesta.tokensSalida,
      salidaCruda: respuesta.texto,
    },
    coherencia,
    motivosExtra,
  };
}