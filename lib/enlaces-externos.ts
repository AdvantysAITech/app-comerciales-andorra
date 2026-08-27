/**
 * Accesos a herramientas externas desde la barra lateral.
 *
 * NO son modulos de la plataforma y por eso no viven en lib/modulos.ts:
 *  - no pasan por el permiso de Supabase (`modulos.clave`), los ve todo el mundo,
 *  - no pasan por `moduloDeRuta()` del middleware, porque no hay ruta interna
 *    detras: son enlaces salientes.
 *
 * Se abren en pestaña nueva a proposito. Si el comercial esta a medio rellenar
 * el alta de un lead y pulsa CRM, no puede perder el formulario.
 *
 * ALR-09: la plataforma de debajo es confidencial. El enlace de CRM apunta al
 * dominio white-label (app.advantys.ai), nunca al dominio real, y la etiqueta
 * visible es siempre "CRM" / "Sistema Advantys".
 */

export type ClaveEnlaceExterno = "crm" | "soporte";

export type EnlaceExterno = {
  clave: ClaveEnlaceExterno;
  nombre: string;
  /** Va al `title`: se lee al pasar el raton, explica adonde lleva. */
  descripcion: string;
  url: string;
};

export const ENLACES_EXTERNOS: EnlaceExterno[] = [
  {
    clave: "crm",
    nombre: "CRM",
    descripcion: "Sistema Advantys — contactos, oportunidades y pipelines",
    url: "https://app.advantys.ai/v2/location/tT0GAvtx8iOs64cDrzg2/contacts/smart_list/All",
  },
  {
    clave: "soporte",
    nombre: "Soporte",
    descripcion: "Formulario de incidencias y peticiones de soporte",
    url: "https://api.leadconnectorhq.com/widget/form/uJZbLme4UEdj5YMRXveI",
  },
];