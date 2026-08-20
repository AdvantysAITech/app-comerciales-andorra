import "server-only";
import { ghl, locationId } from "./client";
import { campo, campoCheckbox } from "./contactos";
import {
  ASOCIACION_SPINOFF_OPORTUNIDAD,
  CAMPO_BANT,
  CAMPO_OPORTUNIDAD,
  PIPELINES_CONFLICTO_INDEPENDENCIA,
  pipelineDestino,
} from "./ids";
import { ETIQUETA_LINEA, ETIQUETA_ROL, type LineaNegocio, type RolJV } from "@/lib/domain/tipos";
import {
  calcularBant,
  etiquetaGhl,
  puntosGhl,
  type CriterioBant,
  type RespuestasBant,
} from "@/lib/domain/bant";

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
  bant?: RespuestasBant;
};

/**
 * ALR-13: GHL no sabe sumar seis campos entre workflows. Como aquí tenemos las
 * seis respuestas en el mismo POST, la suma la hace la app y GHL recibe el
 * total ya hecho. Se escriben también los seis `BANT pts *` para que el score
 * quede auditable desde la ficha sin recalcular nada a mano.
 */
function camposBant(bant: RespuestasBant | undefined) {
  const respuestas = bant ?? {};
  const resultado = calcularBant(respuestas);

  const porCriterio = (Object.keys(CAMPO_BANT) as CriterioBant[]).flatMap((criterio) => {
    const ids = CAMPO_BANT[criterio];
    const valor = respuestas[criterio];
    return [
      // Authority es CHECKBOX en GHL y necesita array; el resto son listas.
      ...(criterio === "authority"
        ? campoCheckbox(ids.respuesta, etiquetaGhl(criterio, valor))
        : campo(ids.respuesta, etiquetaGhl(criterio, valor))),
      ...campo(ids.puntos, puntosGhl(criterio, valor)),
    ];
  });

  // Sin una sola respuesta no se escribe el total: un 0 marcaría el lead como
  // COLD y dispararía WF-02 sobre un lead que en realidad esta sin cualificar.
  return resultado.respondidas === 0
    ? { campos: porCriterio, resultado }
    : {
        campos: [...porCriterio, ...campo(CAMPO_OPORTUNIDAD.bant_score_total, resultado.total)],
        resultado,
      };
}

function nombreOportunidad(d: DatosOportunidad): string {
  if (d.linea === "jv_builder" && d.rolJV)
    return `${d.empresa} — ${d.spinoffNombre} — ${ETIQUETA_ROL[d.rolJV]}`;
  if (d.linea === "auditoria_iso42001") return `${d.empresa} — Auditoría ISO 42001`;
  return `${d.empresa} — Consultoría`;
}

export async function crearOportunidad(d: DatosOportunidad, contactoId: string) {
  const destino = pipelineDestino(d.linea, d.rolJV);
  const bant = camposBant(d.bant);

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
        ...bant.campos,
      ],
    },
  });

  if (!res.opportunity?.id) throw new Error("GHL no devolvió el id de la oportunidad");
  return { id: res.opportunity.id, pipelineId: destino.id, bant: bant.resultado };
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