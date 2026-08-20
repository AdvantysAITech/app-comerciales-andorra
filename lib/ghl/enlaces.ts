import { locationId } from "./client";

/**
 * Enlaces profundos al Sistema Advantys.
 *
 * ALR-09: la plataforma de debajo es confidencial. La URL es lo único de la app
 * que puede delatarla, así que la base es configurable: si tenéis dominio
 * white-label, ponedlo en GHL_APP_URL y nunca aparece el dominio real.
 * En la interfaz, estos enlaces se etiquetan siempre "Sistema Advantys".
 *
 * Se construyen en el servidor a propósito: así el location id no viaja al
 * cliente ni hace falta exponerlo como NEXT_PUBLIC_.
 */
const base = () => (process.env.GHL_APP_URL ?? "https://app.gohighlevel.com").replace(/\/+$/, "");

export function enlaceContacto(contactoId: string | null | undefined) {
  if (!contactoId) return null;
  return `${base()}/v2/location/${locationId()}/contacts/detail/${contactoId}`;
}

export function enlaceOportunidad(oportunidadId: string | null | undefined) {
  if (!oportunidadId) return null;
  // El detalle de oportunidad se abre sobre el listado del pipeline. Si en
  // vuestra cuenta la URL es otra, este es el único punto a tocar.
  return `${base()}/v2/location/${locationId()}/opportunities/list?opportunityId=${oportunidadId}`;
}