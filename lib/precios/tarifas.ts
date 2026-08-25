import "server-only";

export const VERSION_TARIFAS = "v1";
export const PASO_REDONDEO_CONSULTORIA = 100;

/* ------------------------------------------------------------------ */
/* 6.1 · Tarifas base                                                  */
/* ------------------------------------------------------------------ */

export const TARIFAS = {
  horaTecnica: 80,
  horaConsultor: 120,
  jornadaIso: 850,
  tarifaEfectiva: 150,
  umbralValidacion: 15_000,
  recargoUrgencia: 0.15,
  recargoUrgenciaIso: 0.12,
  suplementoJornadaPresencial: 450,
} as const;

/* ------------------------------------------------------------------ */
/* 6.2 · Ruta 1                                                        */
/* ------------------------------------------------------------------ */

export const RUTA_1 = {
  base: 2_500,
  porAreaAdicional: 600,
} as const;

/* ------------------------------------------------------------------ */
/* 6.3 · Ruta 2                                                        */
/* ------------------------------------------------------------------ */

export const RUTA_2 = {
  base: 2_500,
  porDepartamentoAdicional: 600,
  porProcesoAdicional: 250,
} as const;

export const PROCESOS_POR_RANGO: Record<string, number> = {
  "1_2": 1.5,
  "3_5": 4,
  "6_10": 8,
  mas_10: 12,
};

export const MODIFICADORES_RUTA_2: { pregunta: string; valores: string[]; recargo: number }[] = [
  { pregunta: "R2.3", valores: ["nada"], recargo: 0.15 },
  { pregunta: "R2.5", valores: ["complejo"], recargo: 0.10 },
  { pregunta: "R2.6", valores: ["sensibles", "regulado"], recargo: 0.10 },
  { pregunta: "R2.7", valores: ["internacional"], recargo: 0.15 },
  { pregunta: "R2.8", valores: ["si"], recargo: 0.20 },
];

/* ------------------------------------------------------------------ */
/* 6.4 · Ruta 3                                                        */
/* ------------------------------------------------------------------ */

export const MODULOS: Record<string, { precio: number; horas: number }> = {
  M01: { precio: 2_400, horas: 16 },
  M02: { precio: 1_200, horas: 8 },
  M03: { precio: 600, horas: 4 },
  M04: { precio: 900, horas: 6 },
  M05: { precio: 900, horas: 6 },

  V01: { precio: 3_000, horas: 20 },
  V02: { precio: 600, horas: 4 },
  V03: { precio: 1_200, horas: 8 },
  V04: { precio: 1_200, horas: 8 },

  P01: { precio: 4_200, horas: 28 },
  P02: { precio: 2_400, horas: 16 },
  P03: { precio: 2_400, horas: 16 },

  G01: { precio: 1_800, horas: 12 },
  G02: { precio: 3_600, horas: 24 },
  G03: { precio: 3_600, horas: 24 },
};

export const RUTA_3 = {
  porIntegracion: 1_200,
  minimoAppMedida: 5_000,
  recargoPorIdiomaAdicional: 0.08,
  recargoMasDe50Usuarios: 0.10,
  factorSuelo: 0.88,
} as const;

export const MIGRACION: Record<string, number> = {
  sin_migracion: 0,
  menos_1000: 600,
  "1000_10000": 1_800,
  mas_10000: 3_600,
};

export const FORMACION: Record<string, number> = {
  sin_formacion: 0,
  sesion_unica: 600,
  plan_por_rol: 1_800,
  acompanamiento_3m: 3_600,
};

/* ------------------------------------------------------------------ */
/* 6.6 · Ruta 5 · ISO 42001                                            */
/* ------------------------------------------------------------------ */

export const FACTORES_ISO: Record<string, Record<string, number>> = {
  I1: { hasta_25: 0, "26_100": 2, "101_250": 4, mas_250: 6 },
  I2: { uno: 0, "2_3": 3, "4_6": 6, "7_o_mas": 9 },
  I3: { solo_terceros: 0, desarrolla: 3, ambas: 4 },
  I4: { bajo: 0, medio: 2, alto: 4 },
  I5: { iso27001: -4, otra: -2, ninguna: 0 },
  I6: { mas_60: -2, "35_60": 0, menos_35: 2, no_lo_hizo: 1 },
  I7: { equipo_dedicado: -2, una_persona: 0, hazlo_tu: 3 },
  I8: { una_sede: 0, nacional: 1, internacional: 3 },
};

export const EXTRAS_ISO: Record<string, number> = {
  auditoria_interna: 3,
  acompanamiento: 2,
  formacion: 2,
};

export const RUTA_5 = {
  jornadasBase: 12,
  factorComplejidad: 1.4,
  jornadasMinimas: 15,
  factorPresentado: 1.15,
  factorSuelo: 0.90,
  sueloDuro: 12_750,
} as const;

/* ------------------------------------------------------------------ */
/* 7.5 · Baseline de coherencia                                        */
/* ------------------------------------------------------------------ */

export const BASELINE = {
  ruta2: {
    base: 8,
    porDepartamento: 6,
    porProceso: 2,
    porEntrevista: 1.5,
    sinDocumentacion: 12,
  },
  x01: {
    base: 40,
    sinCobertura: 20,
    movilYEscritorio: 16,
    generaDocumentos: 16,
    firmaOFotos: 12,
    conectaSistema: 16,
  },
  /** Desviación máxima tolerada entre la IA y el baseline (7.5). */
  desviacionMaxima: 0.25,
} as const;

export const ENTREVISTAS_POR_RANGO: Record<string, number> = {
  "1_3": 2,
  "4_8": 6,
  "9_15": 12,
  mas_15: 18,
};

/* ------------------------------------------------------------------ */
/* Redondeo                                                            */
/* ------------------------------------------------------------------ */

export const truncarA = (valor: number, paso: number) => Math.floor(valor / paso) * paso;