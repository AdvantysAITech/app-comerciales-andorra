/** Tipos compartidos del dominio. DERCAS v3.4 — 2.1, 2.2, RF-16, RF-27. */

export const LINEAS = ["consultoria", "jv_builder", "iso42001"] as const;
export type LineaNegocio = (typeof LINEAS)[number];

export const ROLES_JV = ["cliente_final", "inversor"] as const;
export type RolJV = (typeof ROLES_JV)[number];

/** Las etiquetas son el texto EXACTO de las opciones en GHL. Si cambias
 *  una opción en GHL, hay que cambiarla aquí o el campo se guardará vacío.
 *
 *  Las CLAVES, en cambio, son internas y estables: no llevan el nombre
 *  comercial. `iso42001` sobrevivió al paso de "Auditoría" a "Implantación"
 *  y sobrevivirá al siguiente cambio. Mismo criterio que `clave_interna`
 *  en el objeto Spin-off de GHL. */
export const ETIQUETA_LINEA: Record<LineaNegocio, string> = {
  consultoria: "Consultoría Tecnológica",
  jv_builder: "Joint Venture Builder",
  iso42001: "Implantación ISO 42001",
};

/** OJO con la f minúscula de "Cliente final": es el texto literal de la opción
 *  en GHL. La API no rechaza una opción inexistente — deja el campo vacío sin
 *  avisar, y la oportunidad se crea sin rol. */
export const ETIQUETA_ROL: Record<RolJV, string> = {
  cliente_final: "Cliente final",
  inversor: "Inversor",
};