import "server-only";
import { ghl, locationId } from "./client";
import { CAMPO_CONTACTO } from "./ids";

export type ContactoGhl = {
  id: string;
  contactName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  companyName?: string;
};

export const campo = (id: string, valor: string | number | undefined | null) =>
  id && valor !== undefined && valor !== null && valor !== "" ? [{ id, field_value: valor }] : [];

export const campoCheckbox = (id: string, valor: string | undefined | null) =>
  id && valor ? [{ id, field_value: [valor] }] : [];

export const campoMulti = (id: string, valores: readonly string[] | undefined) =>
  id && valores && valores.length ? [{ id, field_value: [...valores] }] : [];

function partirNombre(nombre: string) {
  const partes = nombre.trim().split(/\s+/);
  return { firstName: partes[0], lastName: partes.slice(1).join(" ") || undefined };
}

export async function buscarContacto(params: {
  email?: string;
  telefono?: string;
}): Promise<ContactoGhl | null> {
  const filters = [];
  if (params.email) filters.push({ field: "email", operator: "eq", value: params.email });
  else if (params.telefono)
    filters.push({ field: "phone", operator: "eq", value: params.telefono });
  if (!filters.length) return null;

  const data = await ghl<{ contacts?: ContactoGhl[] }>("/contacts/search", {
    method: "POST",
    body: { locationId: locationId(), page: 1, pageLimit: 1, filters },
  });

  return data.contacts?.[0] ?? null;
}

/**
 * Lo obligatorio es lo que abre la ficha: nombre, email, teléfono y empresa.
 * El resto es opcional desde el 07/09/2026, porque el alta dejó de pedirlo y
 * se completa después en el Sistema Advantys.
 *
 * `campo()` ya descarta lo vacío, así que un contacto incompleto no manda
 * campos en blanco: simplemente no los manda, y GHL conserva lo que hubiera
 * si el contacto ya existía. Eso importa: un alta rápida no puede borrar
 * datos que alguien rellenó a mano.
 */
export type DatosContacto = {
  nombre: string;
  email: string;
  telefono: string;
  empresa: string;
  cargo?: string;
  ciudad?: string;
  /** ISO-3166-1 alfa-2. Ver `paisIso()`: cualquier otra cosa se descarta. */
  pais?: string;
  web?: string;
  fuente?: string;
  idioma?: string;
  sector?: string;
  empleados?: string;
  facturacion?: string;
  herramientas?: string;
};

/**
 * `country` en GoHighLevel solo entiende ISO-3166-1 alfa-2. Lo que no lo sea
 * lo descarta SIN error, así que un «España» escrito a mano no llega nunca y
 * el contacto acaba con el país por defecto de la location.
 *
 * No se adivina el código a partir del nombre: adivinar es exactamente lo que
 * hace GHL, y es de donde viene el problema. Si el dato no sirve, se anota en
 * el log y se trata como si no viniera.
 */
function paisIso(pais: string | undefined): string | undefined {
  if (!pais) return undefined;
  if (/^[A-Za-z]{2}$/.test(pais)) return pais.toUpperCase();
  console.warn(`[ghl] país descartado por no ser ISO-2: ${pais}`);
  return undefined;
}

export async function upsertContacto(
  d: DatosContacto,
): Promise<{ id: string; nuevo: boolean }> {
  const { firstName, lastName } = partirNombre(d.nombre);
  const pais = paisIso(d.pais);

  const res = await ghl<{ contact?: { id: string }; new?: boolean }>("/contacts/upsert", {
    method: "POST",
    body: {
      locationId: locationId(),
      firstName,
      lastName,
      name: d.nombre,
      email: d.email,
      phone: d.telefono,
      companyName: d.empresa,
      website: d.web || undefined,
      city: d.ciudad || undefined,
      country: pais,
      // Sin fuente, «App Comercial» a secas. Antes salía «App Comercial ·
      // undefined» en cuanto el campo faltaba.
      source: d.fuente ? `App Comercial · ${d.fuente}` : "App Comercial",
      customFields: [
        ...campo(CAMPO_CONTACTO.cargo, d.cargo),
        ...campo(CAMPO_CONTACTO.web_empresa, d.web),
        ...campo(CAMPO_CONTACTO.fuente_captacion, d.fuente),
        ...campo(CAMPO_CONTACTO.idioma_preferido, d.idioma),
        ...campo(CAMPO_CONTACTO.sector, d.sector),
        ...campo(CAMPO_CONTACTO.empleados, d.empleados),
        ...campo(CAMPO_CONTACTO.facturacion, d.facturacion),
        ...campo(CAMPO_CONTACTO.herramientas, d.herramientas),
      ],
    },
  });

  if (!res.contact?.id) throw new Error("GHL no devolvió el id del contacto");
  const nuevo = res.new === true;

  /**
   * GHL rellena `country` con el país de la location —Andorra— cuando el
   * upsert no lo trae. Como el alta no pregunta el país y este se completa a
   * mano después en el Sistema Advantys, ese valor por defecto no es un dato
   * incompleto: es un dato falso que nadie va a corregir, porque parece
   * correcto. Un campo vacío sí se ve y sí se rellena.
   *
   * Solo en contactos NUEVOS. Sobre uno que ya existía, mandar "" borraría el
   * país que alguien puso a mano, y un alta duplicada no puede deshacer
   * trabajo hecho en el CRM — es la misma regla que sigue `campo()`.
   */
  if (nuevo && !pais) {
    try {
      await ghl(`/contacts/${res.contact.id}`, { method: "PUT", body: { country: "" } });
    } catch (e) {
      // No es motivo para tumbar el alta: el contacto está creado y el resto
      // de los datos son correctos. Se queda el país por defecto, que es el
      // comportamiento que había hasta ahora.
      console.warn("[ghl] no se pudo vaciar el país del contacto nuevo", e);
    }
  }

  return { id: res.contact.id, nuevo };
}

export async function crearNota(contactoId: string, body: string) {
  await ghl(`/contacts/${contactoId}/notes`, { method: "POST", body: { body } });
}