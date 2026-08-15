import "server-only";
import { ghl, locationId } from "./client";
import { campo } from "./contactos";
import {
  ASOCIACION_SPINOFF_OPORTUNIDAD,
  CAMPO_OPORTUNIDAD,
  PIPELINES_CONFLICTO_INDEPENDENCIA,
  pipelineDestino,
} from "./ids";
import { ETIQUETA_LINEA, ETIQUETA_ROL, type LineaNegocio, type RolJV } from "@/lib/domain/tipos";

export type OportunidadGhl = {
  id: string;
  name?: string;
  status?: string;
  pipelineId?: string;
};

/**
 * WF-16 — independencia del auditor.
 * Se calcula en vivo consultando las oportunidades Ganadas del contacto, en vez
 * de leer el campo "¿Cliente de otra línea de negocio?" de GHL: los campos
 * calculados de GHL no son fiables (misma limitación que con la suma BANT) y
 * aquí un falso negativo significa venderle una auditoría a un cliente propio.
 */
export async function tieneConflictoIndependencia(contactoId: string) {
  const data = await ghl<{ opportunities?: OportunidadGhl[] }>("/opportunities/search", {
    query: { location_id: locationId(), contact_id: contactoId, status: "won", limit: 100 },
  });

  const enConflicto = (data.opportunities ?? []).filter(
    (o) => o.pipelineId && PIPELINES_CONFLICTO_INDEPENDENCIA.includes(o.pipelineId),
  );

  return { conflicto: enConflicto.length > 0, oportunidades: enConflicto };
}

export type DatosOportunidad = {
  empresa: string;
  linea: LineaNegocio;
  rolJV?: RolJV;
  spinoffId?: string;
  spinoffNombre?: string;
  valorEstimado?: number;
  pain?: string;
};

function nombreOportunidad(d: DatosOportunidad): string {
  if (d.linea === "jv_builder" && d.rolJV)
    return `${d.empresa} — ${d.spinoffNombre} — ${ETIQUETA_ROL[d.rolJV]}`;
  if (d.linea === "auditoria_iso42001") return `${d.empresa} — Auditoría ISO 42001`;
  return `${d.empresa} — Consultoría`;
}

export async function crearOportunidad(d: DatosOportunidad, contactoId: string) {
  const destino = pipelineDestino(d.linea, d.rolJV);

  const res = await ghl<{ opportunity?: { id: string } }>("/opportunities/", {
    method: "POST",
    body: {
      locationId: locationId(),
      pipelineId: destino.id,
      pipelineStageId: destino.primeraFase,
      name: nombreOportunidad(d),
      status: "open",
      contactId: contactoId,
      monetaryValue: d.valorEstimado ?? 0,
      customFields: [
        ...campo(CAMPO_OPORTUNIDAD.linea_negocio, ETIQUETA_LINEA[d.linea]),
        ...campo(CAMPO_OPORTUNIDAD.rol_jv, d.rolJV ? ETIQUETA_ROL[d.rolJV] : undefined),
        ...campo(CAMPO_OPORTUNIDAD.pain_declarado, d.pain),
      ],
    },
  });

  if (!res.opportunity?.id) throw new Error("GHL no devolvió el id de la oportunidad");
  return { id: res.opportunity.id, pipelineId: destino.id };
}

/** La spin-off no es un campo: es una asociación entre dos registros. */
export async function vincularSpinoff(spinoffId: string, oportunidadId: string) {
  await ghl("/associations/relations", {
    method: "POST",
    body: {
      locationId: locationId(),
      associationId: ASOCIACION_SPINOFF_OPORTUNIDAD.id,
      firstRecordId: spinoffId,
      secondRecordId: oportunidadId,
    },
  });
}