import "server-only";
import type { Ruta } from "@/lib/domain/rutas";
import type { RespuestasChecklist } from "@/lib/domain/checklists";
import { MODULO_APP_MEDIDA } from "@/lib/domain/checklists";
import type { EstadoPresupuesto } from "@/lib/domain/servicio";
import { procesosTotales } from "./baseline";
import {
  TARIFAS,
  RUTA_1,
  RUTA_2,
  RUTA_3,
  RUTA_5,
  MODIFICADORES_RUTA_2,
  MODULOS,
  MIGRACION,
  FORMACION,
  FACTORES_ISO,
  EXTRAS_ISO,
  VERSION_TARIFAS,
  PASO_REDONDEO_CONSULTORIA,
  truncarA,
} from "./tarifas";

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

export type LineaDesglose = { concepto: string; importe: number };

type ResultadoRuta = {
  desglose: LineaDesglose[];
  total: number;
  suelo: number;
  avisos: string[];
};

export type Calculo = {
  ruta: Ruta;
  version: string;
  presentado: number | null;
  suelo: number | null;
  desglose: LineaDesglose[];
  estado: EstadoPresupuesto;
  motivos: string[];
  avisos: string[];
};

export type EntradaCalculo = {
  ruta: Ruta;
  respuestas: RespuestasChecklist;
  horasX01?: number;
  confianzaIa?: "alta" | "media" | "baja";
  coherenciaAceptable?: boolean;
  motivoCoherencia?: string;
};

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

const texto = (r: RespuestasChecklist, id: string) =>
  typeof r[id] === "string" ? (r[id] as string) : undefined;
const lista = (r: RespuestasChecklist, id: string) =>
  Array.isArray(r[id]) ? (r[id] as string[]) : [];
const numero = (r: RespuestasChecklist, id: string) =>
  typeof r[id] === "number" ? (r[id] as number) : 0;

const suma = (lineas: LineaDesglose[]) => lineas.reduce((s, l) => s + l.importe, 0);

/* ------------------------------------------------------------------ */
/* 6.2 · Ruta 1                                                        */
/* ------------------------------------------------------------------ */

function calcularRuta1(r: RespuestasChecklist): ResultadoRuta {
  const areas = Math.max(1, lista(r, "R1.1").length);
  const jornadas = numero(r, "R1.5a");

  const desglose: LineaDesglose[] = [
    { concepto: "Análisis de un área", importe: RUTA_1.base },
  ];
  if (areas > 1) {
    desglose.push({
      concepto: `${areas - 1} área(s) adicional(es)`,
      importe: RUTA_1.porAreaAdicional * (areas - 1),
    });
  }
  if (jornadas > 0) {
    desglose.push({
      concepto: `${jornadas} jornada(s) presencial(es)`,
      importe: TARIFAS.suplementoJornadaPresencial * jornadas,
    });
  }

  const total = truncarA(suma(desglose), PASO_REDONDEO_CONSULTORIA);
  return { desglose, total, suelo: total, avisos: [] };
}

/* ------------------------------------------------------------------ */
/* 6.3 · Ruta 2                                                        */
/* ------------------------------------------------------------------ */

function calcularRuta2(r: RespuestasChecklist): ResultadoRuta {
  const departamentos = Math.max(1, lista(r, "R2.1").length);
  const procesos = Math.max(1, procesosTotales(r));
  const jornadas = numero(r, "R2.9a");

  const desglose: LineaDesglose[] = [
    { concepto: "Base: un departamento, un proceso", importe: RUTA_2.base },
  ];
  if (departamentos > 1) {
    desglose.push({
      concepto: `${departamentos - 1} departamento(s) adicional(es)`,
      importe: RUTA_2.porDepartamentoAdicional * (departamentos - 1),
    });
  }
  if (procesos > 1) {
    desglose.push({
      concepto: `${procesos} procesos analizados`,
      importe: RUTA_2.porProcesoAdicional * (procesos - 1),
    });
  }
  if (jornadas > 0) {
    desglose.push({
      concepto: `${jornadas} jornada(s) presencial(es)`,
      importe: TARIFAS.suplementoJornadaPresencial * jornadas,
    });
  }

  const subtotal = suma(desglose);

  let recargoTotal = 0;
  for (const m of MODIFICADORES_RUTA_2) {
    const valor = texto(r, m.pregunta);
    if (valor && m.valores.includes(valor)) recargoTotal += m.recargo;
  }
  if (recargoTotal > 0) {
    desglose.push({
      concepto: `Complejidad (+${Math.round(recargoTotal * 100)}%)`,
      importe: subtotal * recargoTotal,
    });
  }

  const total = truncarA(suma(desglose), PASO_REDONDEO_CONSULTORIA);
  return { desglose, total, suelo: total, avisos: [] };
}

/* ------------------------------------------------------------------ */
/* 6.4 · Ruta 3                                                        */
/* ------------------------------------------------------------------ */

function calcularRuta3(r: RespuestasChecklist, horasX01?: number): ResultadoRuta {
  const avisos: string[] = [];
  const seleccionados = lista(r, "R3.1");
  const desglose: LineaDesglose[] = [];

  for (const codigo of seleccionados) {
    const modulo = MODULOS[codigo];
    if (modulo) desglose.push({ concepto: `Módulo ${codigo}`, importe: modulo.precio });
  }

  if (seleccionados.includes(MODULO_APP_MEDIDA)) {
    if (horasX01 === undefined) {
      desglose.push({
        concepto: "Aplicación a medida (mínimo, pendiente de estimación)",
        importe: RUTA_3.minimoAppMedida,
      });
      avisos.push(
        "El precio no incluye todavía la estimación de la aplicación a medida. " +
          "Es un importe parcial: no lo compartas con el cliente.",
      );
    } else {
      desglose.push({
        concepto: "Aplicación a medida",
        importe: Math.max(RUTA_3.minimoAppMedida, horasX01 * TARIFAS.tarifaEfectiva),
      });
    }
  }

  const integraciones = numero(r, "R3.2");
  if (integraciones > 0) {
    desglose.push({
      concepto: `${integraciones} integración(es) con sistemas externos`,
      importe: RUTA_3.porIntegracion * integraciones,
    });
  }

  const migracion = MIGRACION[texto(r, "R3.4") ?? ""] ?? 0;
  if (migracion > 0) desglose.push({ concepto: "Migración de datos", importe: migracion });

  const subtotalBase = suma(desglose);

  const idiomasExtra = Math.max(0, numero(r, "R3.6") - 1);
  const usuariosExtra = texto(r, "R3.5") === "mas_50" ? RUTA_3.recargoMasDe50Usuarios : 0;

  const subtotal =
    subtotalBase * (1 + idiomasExtra * RUTA_3.recargoPorIdiomaAdicional) * (1 + usuariosExtra);

  if (subtotal !== subtotalBase) {
    desglose.push({
      concepto: `Idiomas adicionales y volumen de usuarios`,
      importe: subtotal - subtotalBase,
    });
  }

  const formacion = FORMACION[texto(r, "R3.7") ?? ""] ?? 0;
  if (formacion > 0) desglose.push({ concepto: "Formación", importe: formacion });

  let total = subtotal + formacion;

  if (texto(r, "R3.8") === "menos_2_meses") {
    const recargo = total * TARIFAS.recargoUrgencia;
    desglose.push({ concepto: "Recargo de urgencia (15%)", importe: recargo });
    total += recargo;
  }

  return {
    desglose,
    total: truncarA(total, 100),
    suelo: truncarA(total * RUTA_3.factorSuelo, 100),
    avisos,
  };
}

/* ------------------------------------------------------------------ */
/* 6.6 · Ruta 5 · ISO 42001                                            */
/* ------------------------------------------------------------------ */

function calcularRuta5(r: RespuestasChecklist): ResultadoRuta {
  let complejidad = 0;
  for (const factor of Object.keys(FACTORES_ISO)) {
    complejidad += FACTORES_ISO[factor][texto(r, factor) ?? ""] ?? 0;
  }

  const extras = lista(r, "R5.extras").reduce((s, e) => s + (EXTRAS_ISO[e] ?? 0), 0);

  const jornadasCrudas = RUTA_5.jornadasBase + complejidad * RUTA_5.factorComplejidad + extras;
  const jornadas = Math.max(RUTA_5.jornadasMinimas, Math.round(jornadasCrudas));

  let precio = jornadas * TARIFAS.jornadaIso;

  const desglose: LineaDesglose[] = [
    { concepto: `${jornadas} jornadas de implantación`, importe: precio },
  ];

  if (texto(r, "I9") === "urgente") {
    const recargo = precio * TARIFAS.recargoUrgenciaIso;
    desglose.push({ concepto: "Recargo de urgencia (12%)", importe: recargo });
    precio += recargo;
  }

  return {
    desglose,
    total: truncarA(precio * RUTA_5.factorPresentado, 250),
    suelo: Math.max(RUTA_5.sueloDuro, truncarA(precio * RUTA_5.factorSuelo, 250)),
    avisos: [],
  };
}

/* ------------------------------------------------------------------ */
/* Entrada única                                                       */
/* ------------------------------------------------------------------ */

export function calcularPrecio(e: EntradaCalculo): Calculo {
  const { ruta, respuestas: r } = e;
  const motivos: string[] = [];
  const avisos: string[] = [];

  const vacio = (estado: EstadoPresupuesto, motivo: string): Calculo => ({
    ruta,
    version: VERSION_TARIFAS,
    presentado: null,
    suelo: null,
    desglose: [],
    estado,
    motivos: [motivo],
    avisos: [],
  });

  if (ruta === "ruta_4") {
    return vacio(
      "pendiente_presupuesto",
      "Proyecto AdHoc: el presupuesto lo elabora el equipo técnico (5 días laborables).",
    );
  }
  if (ruta === "ruta_6" || ruta === "ruta_7") {
    return vacio("borrador", "Ruta de spin-off: sin cálculo de precio.");
  }

  const resultado =
    ruta === "ruta_1"
      ? calcularRuta1(r)
      : ruta === "ruta_2"
        ? calcularRuta2(r)
        : ruta === "ruta_3"
          ? calcularRuta3(r, e.horasX01)
          : calcularRuta5(r);

  avisos.push(...resultado.avisos);

  /* 6.8 · Umbral de validación ------------------------------------- */

  if (resultado.total > TARIFAS.umbralValidacion) {
    motivos.push(
      `Importe de ${resultado.total.toLocaleString("es-ES")} € por encima del ` +
        `umbral de ${TARIFAS.umbralValidacion.toLocaleString("es-ES")} €.`,
    );
  }
  if (lista(r, "R3.1").includes(MODULO_APP_MEDIDA)) {
    motivos.push("Incluye aplicación a medida (X01): la estimación no sale de tabla.");
  }
  if (ruta === "ruta_5") {
    motivos.push("ISO 42001 se reserva y se ejecuta desde enero de 2027.");
  }
  if (e.confianzaIa === "baja") {
    motivos.push("La IA ha declarado confianza baja sobre el alcance.");
  }
  if (e.coherenciaAceptable === false) {
    motivos.push(e.motivoCoherencia ?? "La estimación de la IA se desvía del baseline.");
  }

  return {
    ruta,
    version: VERSION_TARIFAS,
    presentado: resultado.total,
    suelo: resultado.suelo,
    desglose: resultado.desglose,
    estado: motivos.length > 0 ? "revision_obligatoria" : "pendiente_validacion",
    motivos,
    avisos,
  };
}

/* ------------------------------------------------------------------ */
/* Filtro de confidencialidad                                          */
/* ------------------------------------------------------------------ */

export function paraComercial(c: Calculo) {
  return {
    ruta: c.ruta,
    presentado: c.presentado,
    estado: c.estado,
    avisos: c.avisos,
    necesitaValidacion: c.estado !== "pendiente_validacion",
  };
}