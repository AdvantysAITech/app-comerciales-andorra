import type { LineaNegocio, RolJV } from "@/lib/domain/tipos";

export type FaseRef = {
  id: string;
  nombre: string;
  /** false = fase de cierre. Un lead nuevo no puede entrar ahí. */
  entrada: boolean;
};

export type PipelineRef = { id: string; fases: FaseRef[] };

export const PIPELINES = {
  desarrollo_negocio: {
    id: "iCYcovYZbhHhCrRYUepk",
    fases: [
      { id: "90e7317e-88e0-4b14-b888-657135493853", nombre: "Prospecto Identificado", entrada: true },
      { id: "2242792e-bab3-4280-abcb-c2ba0ae0da28", nombre: "Primer Contacto", entrada: true },
      { id: "c528fc4a-f7a9-4ac8-952d-fa6e493176f7", nombre: "Reunión Agendada", entrada: true },
      { id: "c238704b-5d06-48c0-a41f-7b85e2a5d818", nombre: "Diagnóstico Realizado", entrada: true },
      { id: "b00f1cec-064a-403d-9052-ef02f89964c0", nombre: "Propuesta Enviada", entrada: true },
      { id: "94503f9c-9875-44db-ab7a-86aa6f124a97", nombre: "Negociación", entrada: true },
      { id: "694e5f2d-fa3a-4124-9e4d-ffb09817bbfd", nombre: "Cerrado Ganado", entrada: false },
      { id: "e6ced160-a22a-477c-982e-b159a19c9e0c", nombre: "Cerrado Perdido", entrada: false },
    ],
  },
  iso42001: {
    id: "fPD7Srb6mpQDf0h3wYbP",
    fases: [
      { id: "ea9a8845-9d5e-4862-a72d-f743e5f6de91", nombre: "Prospecto Identificado", entrada: true },
      { id: "3e7db295-1e8c-4b2f-8aad-e786270d1178", nombre: "Primer Contacto", entrada: true },
      { id: "42486f66-9217-4206-9d02-19223960cf9c", nombre: "Alcance y Propuesta de Auditoría", entrada: true },
      { id: "201594be-bbca-4310-963c-ae40d5a668f9", nombre: "Contrato Firmado", entrada: true },
      { id: "582680d0-3335-4d0a-b1c7-eccc0df87c2c", nombre: "Auditoría en Curso", entrada: true },
      { id: "2f26d641-9963-4680-a512-dfbf08ceb31b", nombre: "Informe Entregado — Ganado", entrada: false },
      { id: "5f04e2ea-e2f5-4db4-9719-8ee40f2302d3", nombre: "Informe Entregado — Perdido", entrada: false },
    ],
  },
  jv_cliente_final: {
    id: "v9TkoUZkqFTigFnDTBHg",
    fases: [
      { id: "16cbbc2a-8471-4a29-ab03-5c3e20f03fdc", nombre: "Prospecto Identificado", entrada: true },
      { id: "ea456bb8-9dcc-4247-8366-a85bf4df58b9", nombre: "Contacto Inicial", entrada: true },
      { id: "e2326fc3-469b-4c3c-9a10-3a7055d78a95", nombre: "Interés / Diagnóstico Validado", entrada: true },
      { id: "c0be7c66-0dc1-43dd-8613-07ac69b6fdd9", nombre: "Propuesta de Implantación", entrada: true },
      { id: "0429e2a4-9a27-49b5-aefb-ca69cda8b313", nombre: "Acuerdo / Piloto Cerrado", entrada: true },
      { id: "5551f77c-951b-4de3-8abc-0ddeaf37f712", nombre: "Cerrado Ganado", entrada: false },
      { id: "5934a48d-0e32-4c43-8343-047539160685", nombre: "Cerrado Perdido", entrada: false },
    ],
  },
  jv_inversor: {
    id: "MRnq3PcUhCaeDd254dJn",
    fases: [
      { id: "6b743753-ea21-42b3-852f-fb5a543ff9f2", nombre: "Prospecto Identificado", entrada: true },
      { id: "b53dfb5c-6dd8-4afe-bda8-5e121589760a", nombre: "Primer Contacto", entrada: true },
      { id: "756bf1eb-f7fe-4803-bf60-c629de6f09a0", nombre: "Presentación de Business Case", entrada: true },
      { id: "fbe69830-80d9-47b4-b330-dfe8ccf5050e", nombre: "Due Diligence", entrada: true },
      { id: "41e1a030-858f-4e4b-bfa1-950fe598756c", nombre: "Compromiso de Inversión", entrada: true },
      { id: "73d8dd32-6a9a-4933-92f4-c41b739beeb3", nombre: "Capital Desembolsado", entrada: true },
      { id: "37aff143-2aa2-439b-9295-127249129697", nombre: "Cerrado Ganado", entrada: false },
      { id: "6595183c-e018-4e5e-ad93-ddc9452d3c6b", nombre: "Cerrado Perdido", entrada: false },
    ],
  },
} satisfies Record<string, PipelineRef>;

export function pipelineDestino(linea: LineaNegocio, rolJV?: RolJV): PipelineRef {
  if (linea === "consultoria") return PIPELINES.desarrollo_negocio;
  if (linea === "iso42001") return PIPELINES.iso42001;
  return rolJV === "inversor" ? PIPELINES.jv_inversor : PIPELINES.jv_cliente_final;
}

export function fasesDeEntrada(linea: LineaNegocio, rolJV?: RolJV): FaseRef[] {
  return pipelineDestino(linea, rolJV).fases.filter((f) => f.entrada);
}

export function faseInicial(linea: LineaNegocio, rolJV?: RolJV): string {
  return fasesDeEntrada(linea, rolJV)[0].id;
}

export function faseValida(linea: LineaNegocio, rolJV: RolJV | undefined, faseId: string) {
  return fasesDeEntrada(linea, rolJV).some((f) => f.id === faseId);
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
  ruta: "swRIBBHgD90zf8b3zY9v",
  modalidad: "oale1hRnvlB9wIb19PmM",
  estado_presupuesto: "SAunyT1dHD1wtDJAEEM3",
  uuid_app_comercial: "GjSIMg4hDstajhjctMWI",
  tipologia_servicio: "NrGxhrkhex28tsxIgBUw",
  /** «Spin-off». Se escribe ademas de la asociacion: la asociacion vive en su
   *  propio panel y no sirve para filtrar ni disparar workflows; el campo si. */
  spinoff: "amNm6OwfrP6r0mInsd0A",
  /** «¿Enviar documentación JV?». Radio Sí/No. Hoy solo lo escribe RUTA 7. */
  info_inversores: "kUSu9kMPU6WNNDiVFNQ6",
  /** «Documentacion». FILE_UPLOAD — se rellena con la subida multipart, no
   *  con un valor de texto en el POST de la oportunidad. */
  documentacion: "8x98MVDlYSPA591T82LR",
} as const;

/**
 * Etiquetas del campo «Spin-off» tal y como estan escritas en GHL.
 *
 * Se mapea desde la clave interna, NO desde el nombre comercial. En la cache
 * los nombres son «IA con Criterio», «ROAT», «Residencia Fiscal Soberana» y
 * «Trazabilidad Industrial», que no coinciden con ninguna opcion del campo:
 * GHL descartaria el valor en silencio y el campo quedaria vacio.
 *
 * Si algun dia cambian las opciones en GHL, este mapa es el unico sitio a
 * tocar. Las claves internas no cambian nunca.
 */
export const ETIQUETA_SPINOFF_GHL: Record<string, string> = {
  educacion: "Educación",
  agro: "Agro",
  hospitality: "Hospitality",
  residencia: "Residencia",
};

export const etiquetaSpinoffGhl = (clave: string | null | undefined) =>
  clave ? ETIQUETA_SPINOFF_GHL[clave] : undefined;

/**
 * Propietario de la oportunidad: email de la App Comercial -> id de usuario de GHL.
 *
 * Va en codigo y no en base de datos porque el equipo son cuatro personas y el
 * alta de un comercial nuevo ya exige tocar GHL, Supabase y permisos. Si el
 * equipo crece, esto pasa a una columna `ghl_user_id` en `profiles`.
 *
 * Las claves en minusculas: el email de Supabase puede llegar con mayusculas y
 * `usuarioGhlPorEmail` normaliza antes de buscar.
 */
export const USUARIO_GHL: Record<string, string> = {
  "jacob.ruiz@advantys.ai": "cjMqmLzEhxp5vIwASDSA",
  "ajsanchez@advantys.ai": "p9OK69Q8S6NiikBxw45d",
  "alex.ruiz@advantys.ai": "u9sc4RnRFwjzr6ZSrCFf",
  // PENDIENTE: confirmar el email exacto con el que Samuel entra en la app.
  // El id de GHL es correcto; lo que falta es la clave con la que se busca.
  "samuel.ruiz@advantys.ai": "mswBBkGVk1a7lzV6NBnn",
};

/**
 * Devuelve el id de GHL del comercial, o undefined si no esta en el mapa.
 *
 * Undefined es deliberado: la oportunidad se crea igual, sin propietario. Un
 * email no reconocido no puede tumbar un alta — se pierde la asignacion, que
 * se arregla en el CRM en dos clics, no el lead.
 */
export function usuarioGhlPorEmail(email: string | null | undefined) {
  if (!email) return undefined;
  return USUARIO_GHL[email.trim().toLowerCase()];
}

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