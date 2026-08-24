import type { LineaNegocio, RolJV } from "@/lib/domain/tipos";

export type PipelineRef = { id: string; primeraFase: string };

export const PIPELINES = {
  desarrollo_negocio: {
    id: "iCYcovYZbhHhCrRYUepk",
    primeraFase: "90e7317e-88e0-4b14-b888-657135493853",
  },
  iso42001: {
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

export function pipelineDestino(linea: LineaNegocio, rolJV?: RolJV): PipelineRef {
  if (linea === "consultoria") return PIPELINES.desarrollo_negocio;
  if (linea === "iso42001") return PIPELINES.iso42001;
  return rolJV === "inversor" ? PIPELINES.jv_inversor : PIPELINES.jv_cliente_final;
}

export const CAMPO_CONTACTO = {
  cargo: "0c8QVxcja2QAJ4idwzgc",
  web_empresa: "mynnj0n08kfN6mtRfOvZ",
  fuente_captacion: "4o4wvoqfHdd8KjsackBH",
  idioma_preferido: "sGCUOmOn6CiGaYCBcQFw",
  sector: "RlIcL7I8n71KVOQsJBsS",
  empleados: "CIpw7OQYrBURxpOiWPjA",
  facturacion: "yIHadowj42KFmcQIk6iq",
  herramientas: "lG6ROliWgf5k9inMkVUb",
} as const;

export const CAMPO_OPORTUNIDAD = {
  linea_negocio: "MRoqR8q4UT7L0YOMpotJ",
  rol_jv: "lfgwNeKAU142WF0dRK95",
  pain_declarado: "iZgonE2aX5eGn88UMIQp",
  procesos_criticos: "4C1X1xw1M0BacQDBtOFw",
  bant_score_total: "4JuRmJLSXZnQSioMqqRv",
  servicio: "qJcyTNPShS2Hb78WLsdn",
  modalidad: "oale1hRnvlB9wIb19PmM",
  estado_presupuesto: "SAunyT1dHD1wtDJAEEM3",
  uuid_app_comercial: "GjSIMg4hDstajhjctMWI",
  tipologia_servicio: "NrGxhrkhex28tsxIgBUw",
} as const;

export const CAMPO_BANT = {
  budget_tiene: { respuesta: "mprVGYr4LSz5UF1rteIc", puntos: "9JxoK6zt63xmA8gJtd6K" },
  budget_rango: { respuesta: "8gqoxNJibDtbDEwP7viD", puntos: "9L9ltBcRo4PiUBCRY3uM" },
  authority: { respuesta: "Wjn65f5HeEU1NcDsIMZA", puntos: "psIMGvhLu3ub36psXo1k" },
  need_urgencia: { respuesta: "yslFF1QyURCPsxd84OHd", puntos: "MEYFKeeDlcOj2ZdfeDm7" },
  need_impacto: { respuesta: "ns4i8GtkjlQHuQsDQlq3", puntos: "PLm5SBZ8EGgRRhhpuxjd" },
  timeline: { respuesta: "HPDaaWFJGv4eV8oK3C9s", puntos: "57dhTrYkvQP6IeLT29fN" },
} as const;

export const CAMPO_DIAGNOSTICO = {
  experiencia_consultora: "1tYmx6xtWyNw4yWVdSfE",
  diagnostico_realizado: "LPTVk66cPrQ7mgHmT9yk",
} as const;

export const OBJETO_SPINOFF = {
  key: "custom_objects.spin_offs",
  propNombre: "custom_objects.spin_offs.nombre_de_la_spin_off",
  propClave: "custom_objects.spin_offs.clave_interna",
} as const;

export const ASOCIACION_SPINOFF_OPORTUNIDAD = {
  id: "6a7dc7507ce3df2087c4b6cc",
  key: "spinoff_vinculada",
} as const;