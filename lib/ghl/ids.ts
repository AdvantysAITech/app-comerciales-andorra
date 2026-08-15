/**
 * Mapa de IDs internos de GHL. Generado desde `npm run ghl:discover`.
 * No editar a mano salvo que se vuelva a ejecutar el script.
 */
import type { LineaNegocio, RolJV } from "@/lib/domain/tipos";

export type PipelineRef = { id: string; primeraFase: string };

export const PIPELINES = {
  desarrollo_negocio: {
    id: "iCYcovYZbhHhCrRYUepk",
    primeraFase: "90e7317e-88e0-4b14-b888-657135493853",
  },
  auditoria_iso: {
    id: "fPD7Srb6mpQDf0h3wYbP",
    primeraFase: "ea9a8845-9d5e-4862-a72d-f743e5f6de91",
  },
  jv_cliente_final: {
    id: "v9TkoUZkqFTigFnDTBHg",
    primeraFase: "16cbbc2a-8471-4a29-ab03-5c3e20f03fdc",
  },
  jv_inversor: {
    id: "MRnq3PcUhCaeDd254dJn",
    primeraFase: "6b743753-ea21-42b3-852f-fb5a543ff9f2",
  },
} satisfies Record<string, PipelineRef>;

/** RF-16: cada lead clasificado cae en un único pipeline, primera fase. */
export function pipelineDestino(linea: LineaNegocio, rolJV?: RolJV): PipelineRef {
  if (linea === "consultoria") return PIPELINES.desarrollo_negocio;
  if (linea === "auditoria_iso42001") return PIPELINES.auditoria_iso;
  return rolJV === "inversor" ? PIPELINES.jv_inversor : PIPELINES.jv_cliente_final;
}

/** WF-16: una oportunidad Ganada en estos pipelines rompe la independencia del auditor. */
export const PIPELINES_CONFLICTO_INDEPENDENCIA: string[] = [
  PIPELINES.desarrollo_negocio.id,
  PIPELINES.jv_cliente_final.id,
  PIPELINES.jv_inversor.id,
];

/** Campos personalizados de Contacto. */
export const CAMPO_CONTACTO = {
  cargo: "0c8QVxcja2QAJ4idwzgc",
  web_empresa: "mynnj0n08kfN6mtRfOvZ",
  fuente_captacion: "4o4wvoqfHdd8KjsackBH",
  idioma_preferido: "sGCUOmOn6CiGaYCBcQFw",
  sector: "RlIcL7I8n71KVOQsJBsS",
  cliente_otra_linea: "dzXy8jp5sM7opgJbJUQe",
} as const;

/** Campos personalizados de Oportunidad. */
export const CAMPO_OPORTUNIDAD = {
  linea_negocio: "MRoqR8q4UT7L0YOMpotJ",
  rol_jv: "lfgwNeKAU142WF0dRK95",
  tipologia_servicio: "NrGxhrkhex28tsxIgBUw",
  pain_declarado: "iZgonE2aX5eGn88UMIQp",
} as const;

/** Objeto personalizado Spin-off. */
export const OBJETO_SPINOFF = {
  key: "custom_objects.spin_offs",
  propNombre: "custom_objects.spin_offs.nombre_de_la_spin_off",
} as const;

/**
 * Asociación Spin-off ↔ Oportunidad.
 * El orden NO es arbitrario: en GHL, firstObjectKey = custom_objects.spin_offs
 * y secondObjectKey = opportunity. Al crear la relación, firstRecordId debe ser
 * la spin-off y secondRecordId la oportunidad. Invertirlo da un error opaco.
 */
export const ASOCIACION_SPINOFF_OPORTUNIDAD = {
  id: "6a7dc7507ce3df2087c4b6cc",
  key: "spinoff_vinculada",
} as const;