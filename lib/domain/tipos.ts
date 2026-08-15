/** Tipos compartidos del dominio. DERCAS v3.4 — 2.1, 2.2, RF-16, RF-27. */

export const LINEAS = ["consultoria", "jv_builder", "auditoria_iso42001"] as const;
export type LineaNegocio = (typeof LINEAS)[number];

export const ROLES_JV = ["cliente_final", "inversor"] as const;
export type RolJV = (typeof ROLES_JV)[number];

/** Las etiquetas son el texto EXACTO de las opciones en GHL. Si cambias
 *  una opción en GHL, hay que cambiarla aquí o el campo se guardará vacío. */
export const ETIQUETA_LINEA: Record<LineaNegocio, string> = {
  consultoria: "Consultoría Tecnológica",
  jv_builder: "Joint Venture Builder",
  auditoria_iso42001: "Auditoría ISO 42001",
};

export const ETIQUETA_ROL: Record<RolJV, string> = {
  cliente_final: "Cliente Final",
  inversor: "Inversor",
};