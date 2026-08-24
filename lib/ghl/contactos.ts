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

export type DatosContacto = {
  nombre: string;
  email: string;
  telefono: string;
  empresa: string;
  cargo?: string;
  ciudadPais: string;
  web?: string;
  fuente: string;
  idioma: string;
  sector: string;
  empleados: string;
  facturacion: string;
  herramientas?: string;
};

export async function upsertContacto(
  d: DatosContacto,
): Promise<{ id: string; nuevo: boolean }> {
  const { firstName, lastName } = partirNombre(d.nombre);

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
      city: d.ciudadPais,
      source: `App Comercial · ${d.fuente}`,
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
  return { id: res.contact.id, nuevo: res.new === true };
}

export async function crearNota(contactoId: string, body: string) {
  await ghl(`/contacts/${contactoId}/notes`, { method: "POST", body: { body } });
}