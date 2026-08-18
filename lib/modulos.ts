/**
 * Catalogo unico de modulos de la Plataforma Advantys.
 *
 * Fuente de verdad para: navbar izquierda, middleware de rutas y pantalla de perfil.
 * La clave de cada modulo debe coincidir EXACTAMENTE con `modulos.clave` en Supabase;
 * si no coinciden, el permiso existe en base de datos pero no se dibuja nada.
 *
 * Todo lo de aqui debe ser serializable: cruza de Server a Client Component.
 * El icono no cabe — vive en components/shell/iconos.ts, indexado por clave.
 */

export type ClaveModulo =
  | "captacion"
  | "nfc"
  | "consultoria"
  | "iso42001"
  | "spinoffs"
  | "rentabilidad"
  | "admin";

/** Los tres momentos del ciclo: captar el negocio, entregarlo, controlarlo. */
export type Grupo = "comercial" | "entrega" | "gestion";

export const GRUPOS: { clave: Grupo; etiqueta: string }[] = [
  { clave: "comercial", etiqueta: "Comercial" },
  { clave: "entrega", etiqueta: "Entrega" },
  { clave: "gestion", etiqueta: "Gestión" },
];

export type Modulo = {
  clave: ClaveModulo;
  nombre: string;
  /** Frase corta para tooltips y la pantalla de inicio. */
  descripcion: string;
  /** Raiz de la seccion. Todo lo que cuelgue de aqui comparte permiso. */
  ruta: string;
  grupo: Grupo;
  /** false = aun no existe; se muestra apagado y no navega. */
  disponible: boolean;
};

export const MODULOS: Modulo[] = [
  {
    clave: "captacion",
    nombre: "Captación",
    descripcion: "Alta y clasificación de leads",
    ruta: "/leads",
    grupo: "comercial",
    disponible: true,
  },
  {
    clave: "nfc",
    nombre: "Tarjetas NFC",
    descripcion: "Tarjetas físicas y landings personalizadas",
    ruta: "/nfc",
    grupo: "comercial",
    disponible: false,
  },
  {
    clave: "consultoria",
    nombre: "Consultoría",
    descripcion: "Jornadas de diagnóstico y DERCAS",
    ruta: "/consultoria",
    grupo: "entrega",
    disponible: true,
  },
  {
    clave: "iso42001",
    nombre: "ISO 42001",
    descripcion: "Implantación del sistema de gestión de IA",
    ruta: "/iso-42001",
    grupo: "entrega",
    disponible: false,
  },
  {
    clave: "spinoffs",
    nombre: "Spin-offs",
    descripcion: "Iniciativas, rondas de inversión y capital",
    ruta: "/spinoffs",
    grupo: "gestion",
    disponible: false,
  },
  {
    clave: "rentabilidad",
    nombre: "Rentabilidad",
    descripcion: "Horas y hitos frente a facturación y coste",
    ruta: "/rentabilidad",
    grupo: "gestion",
    disponible: false,
  },
  {
    clave: "admin",
    nombre: "Administración",
    descripcion: "Usuarios, permisos y configuración",
    ruta: "/admin",
    grupo: "gestion",
    disponible: false,
  },
];

export const MODULOS_POR_CLAVE = new Map(MODULOS.map((m) => [m.clave, m]));

/** Devuelve los modulos visibles para un conjunto de claves con permiso concedido. */
export function modulosPermitidos(claves: readonly string[]): Modulo[] {
  const set = new Set(claves);
  return MODULOS.filter((m) => set.has(m.clave));
}

/** Agrupa para el navbar. Los grupos sin modulos visibles no se devuelven. */
export function agruparModulos(
  modulos: Modulo[],
): { etiqueta: string; modulos: Modulo[] }[] {
  return GRUPOS.map(({ clave, etiqueta }) => ({
    etiqueta,
    modulos: modulos.filter((m) => m.grupo === clave),
  })).filter((g) => g.modulos.length > 0);
}

/** Dada una ruta, dice a que modulo pertenece. Lo usara el middleware. */
export function moduloDeRuta(pathname: string): Modulo | undefined {
  return MODULOS.find(
    (m) => pathname === m.ruta || pathname.startsWith(m.ruta + "/"),
  );
}