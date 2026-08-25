import "server-only";
import { BASELINE, ENTREVISTAS_POR_RANGO, PROCESOS_POR_RANGO } from "./tarifas";
import type { RespuestasChecklist } from "@/lib/domain/checklists";

const texto = (r: RespuestasChecklist, id: string) =>
  typeof r[id] === "string" ? (r[id] as string) : undefined;

const lista = (r: RespuestasChecklist, id: string) =>
  Array.isArray(r[id]) ? (r[id] as string[]) : [];

export function procesosTotales(r: RespuestasChecklist): number {
  const porDepartamento = (r["R2.2"] ?? {}) as Record<string, string>;
  return Object.values(porDepartamento).reduce(
    (suma, rango) => suma + (PROCESOS_POR_RANGO[rango] ?? 0),
    0,
  );
}

export function baselineRuta2(r: RespuestasChecklist): number {
  const b = BASELINE.ruta2;
  const departamentos = lista(r, "R2.1").length;
  const entrevistas = ENTREVISTAS_POR_RANGO[texto(r, "R2.4") ?? ""] ?? 0;

  return (
    b.base +
    departamentos * b.porDepartamento +
    procesosTotales(r) * b.porProceso +
    entrevistas * b.porEntrevista +
    (texto(r, "R2.3") === "nada" ? b.sinDocumentacion : 0)
  );
}

export function baselineX01(r: RespuestasChecklist): number {
  const b = BASELINE.x01;
  return (
    b.base +
    (texto(r, "R3.9b") === "si" ? b.sinCobertura : 0) +
    (texto(r, "R3.9c") === "ambos" ? b.movilYEscritorio : 0) +
    (texto(r, "R3.9d") === "si" ? b.generaDocumentos : 0) +
    (texto(r, "R3.9e") === "si" ? b.firmaOFotos : 0) +
    (texto(r, "R3.9f") ? b.conectaSistema : 0)
  );
}

export type Coherencia = {
  baseline: number;
  estimadoIa: number;
  desviacion: number;
  aceptable: boolean;
  motivo?: string;
};

export function comprobarCoherencia(baseline: number, estimadoIa: number): Coherencia {
  if (baseline <= 0) {
    return {
      baseline,
      estimadoIa,
      desviacion: 0,
      aceptable: false,
      motivo: "No hay datos suficientes para calcular el baseline de horas.",
    };
  }

  const desviacion = (estimadoIa - baseline) / baseline;
  const aceptable = Math.abs(desviacion) <= BASELINE.desviacionMaxima;

  return {
    baseline,
    estimadoIa,
    desviacion,
    aceptable,
    motivo: aceptable
      ? undefined
      : `La IA estima ${estimadoIa} h frente a un baseline de ${baseline} h ` +
        `(${desviacion > 0 ? "+" : ""}${Math.round(desviacion * 100)}%). ` +
        `Supera el ${BASELINE.desviacionMaxima * 100}% tolerado.`,
  };
}