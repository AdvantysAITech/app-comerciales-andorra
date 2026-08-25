/**
 * Edición y borrado de registros en GHL.
 *
 * Separado de contactos.ts y oportunidades.ts, que solo saben crear: aquí vive
 * todo lo que modifica o destruye lo ya creado, que es donde están los riesgos.
 */
import "server-only";
import { ghl, locationId, GhlError } from "./client";
import { campo, campoCheckbox, campoMulti, type DatosContacto } from "./contactos";
import { CAMPO_CONTACTO, CAMPO_OPORTUNIDAD, CAMPO_BANT, pipelineDestino } from "./ids";
import { ETIQUETA_LINEA, ETIQUETA_ROL, type LineaNegocio, type RolJV } from "@/lib/domain/tipos";
import {
  calcularBant,
  etiquetaGhl,
  puntosGhl,
  type CriterioBant,
  type RespuestasBant,
} from "@/lib/domain/bant";
import { ETIQUETA_SERVICIO, type Servicio } from "@/lib/domain/servicio";

/* ------------------------------------------------------------------ */
/* Contacto                                                            */
/* ------------------------------------------------------------------ */

/**
 * PUT sobre un contacto existente.
 *
 * No lleva `locationId` en el cuerpo: en la API de GHL, el update de contacto
 * lo rechaza. El contacto ya pertenece a una sub-cuenta y no se mueve.
 */
export async function actualizarContacto(contactoId: string, d: DatosContacto) {
  const partes = d.nombre.trim().split(/\s+/);

  await ghl(`/contacts/${contactoId}`, {
    method: "PUT",
    body: {
      firstName: partes[0],
      lastName: partes.slice(1).join(" ") || undefined,
      name: d.nombre,
      email: d.email,
      phone: d.telefono,
      companyName: d.empresa,
      website: d.web || undefined,
      city: d.ciudadPais,
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
}

export async function borrarContacto(contactoId: string) {
  await ghl(`/contacts/${contactoId}`, { method: "DELETE" });
}

/**
 * ¿Le queda alguna oportunidad a este contacto?
 *
 * Se consulta ANTES de plantearse borrar el contacto. Si la consulta falla,
 * devuelve `null` y quien llama debe entenderlo como «no lo sé» y no borrar:
 * un fallo de red no puede acabar en un contacto destruido.
 */
export async function cuentaOportunidades(contactoId: string): Promise<number | null> {
  try {
    const data = await ghl<{ opportunities?: unknown[]; total?: number }>(
      "/opportunities/search",
      { query: { location_id: locationId(), contactId: contactoId, limit: 20 } },
    );
    return data.total ?? data.opportunities?.length ?? 0;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Oportunidad                                                         */
/* ------------------------------------------------------------------ */

export type DatosEdicionOportunidad = {
  empresa: string;
  linea: LineaNegocio;
  rolJV?: RolJV;
  spinoffNombre?: string;
  servicio?: Servicio;
  valorEstimado?: number;
  pain?: string;
  procesos?: readonly string[];
  bant?: RespuestasBant;
};

function nombreOportunidad(d: DatosEdicionOportunidad): string {
  if (d.linea === "jv_builder" && d.rolJV) {
    return `${d.empresa} — ${d.spinoffNombre} — ${ETIQUETA_ROL[d.rolJV]}`;
  }
  if (d.servicio) return `${d.empresa} — ${ETIQUETA_SERVICIO[d.servicio]}`;
  return `${d.empresa} — ${ETIQUETA_LINEA[d.linea]}`;
}

/**
 * PUT sobre una oportunidad existente.
 *
 * No se toca ni el pipeline ni la fase: la ruta es inmutable una vez creado el
 * lead (GHL no mueve oportunidades entre pipelines, habría que borrarla y
 * crearla de nuevo), y la fase la lleva el comercial desde el propio CRM —
 * pisarla desde aquí retrocedería una oportunidad que ya haya avanzado.
 */
export async function actualizarOportunidad(
  oportunidadId: string,
  d: DatosEdicionOportunidad,
) {
  const respuestas = d.bant ?? {};
  const resultado = calcularBant(respuestas);

  const camposBant = (Object.keys(CAMPO_BANT) as CriterioBant[]).flatMap((criterio) => {
    const ids = CAMPO_BANT[criterio];
    const valor = respuestas[criterio];
    return [
      ...(criterio === "authority"
        ? campoCheckbox(ids.respuesta, etiquetaGhl(criterio, valor))
        : campo(ids.respuesta, etiquetaGhl(criterio, valor))),
      ...campo(ids.puntos, puntosGhl(criterio, valor)),
    ];
  });

  await ghl(`/opportunities/${oportunidadId}`, {
    method: "PUT",
    body: {
      pipelineId: pipelineDestino(d.linea, d.rolJV).id,
      name: nombreOportunidad(d),
      monetaryValue: d.valorEstimado ?? 0,
      customFields: [
        ...campo(CAMPO_OPORTUNIDAD.pain_declarado, d.pain),
        ...campoMulti(CAMPO_OPORTUNIDAD.procesos_criticos, d.procesos),
        ...camposBant,
        // Igual que en el alta: sin una sola respuesta no se escribe el total,
        // porque un 0 marcaría como COLD un lead que solo está sin cualificar.
        ...(resultado.respondidas === 0
          ? []
          : campo(CAMPO_OPORTUNIDAD.bant_score_total, resultado.total)),
      ],
    },
  });

  return resultado;
}

/**
 * Borra la oportunidad. Un 404 se traga: si ya no está en GHL, el objetivo
 * está cumplido y no tiene sentido bloquear el borrado en la app por ello.
 */
export async function borrarOportunidad(oportunidadId: string) {
  try {
    await ghl(`/opportunities/${oportunidadId}`, { method: "DELETE" });
  } catch (error) {
    if (error instanceof GhlError && error.status === 404) return;
    throw error;
  }
}