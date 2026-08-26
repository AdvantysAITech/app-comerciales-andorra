import "server-only";
import { ghl, locationId } from "./client";
import { campo, campoCheckbox, campoMulti } from "./contactos";
import {
  ASOCIACION_SPINOFF_OPORTUNIDAD,
  CAMPO_BANT,
  CAMPO_OPORTUNIDAD,
  pipelineDestino,
  faseInicial,
  faseValida,
} from "./ids";
import { ETIQUETA_LINEA, ETIQUETA_ROL, type LineaNegocio, type RolJV } from "@/lib/domain/tipos";
import {
  calcularBant,
  etiquetaGhl,
  puntosGhl,
  type CriterioBant,
  type RespuestasBant,
} from "@/lib/domain/bant";
import { etiquetaInfoInversores } from "@/lib/domain/visibilidad";
import {
  ETIQUETA_SERVICIO,
  ETIQUETA_MODALIDAD,
  ETIQUETA_ESTADO_PRESUPUESTO,
  ESTADO_PRESUPUESTO_INICIAL,
  type Servicio,
  type Modalidad,
  EstadoPresupuesto,
} from "@/lib/domain/servicio";


export type DatosOportunidad = {
  empresa: string;
  linea: LineaNegocio;
  rolJV?: RolJV;
  spinoffId?: string;
  spinoffNombre?: string;
  valorEstimado?: number;
  ruta?: string;
  pain?: string;
  bant?: RespuestasBant;
  servicio?: Servicio;
  modalidad?: Modalidad;
  procesos?: readonly string[];
  uuid: string;
  faseId?: string;
  estadoPresupuesto?: EstadoPresupuesto;
  /** RUTA 7. `undefined` en el resto de rutas: el campo no se escribe. */
  infoInversores?: boolean;
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
  if (d.linea === "jv_builder" && d.rolJV) {
    return `${d.empresa} — ${d.spinoffNombre} — ${ETIQUETA_ROL[d.rolJV]}`;
  }
  if (d.servicio) return `${d.empresa} — ${ETIQUETA_SERVICIO[d.servicio]}`;
  return `${d.empresa} — ${ETIQUETA_LINEA[d.linea]}`;
}

export async function crearOportunidad(d: DatosOportunidad, contactoId: string) {
  const destino = pipelineDestino(d.linea, d.rolJV);
  const bant = camposBant(d.bant);

  const faseId =
      d.faseId && faseValida(d.linea, d.rolJV, d.faseId)
        ? d.faseId
        : faseInicial(d.linea, d.rolJV);

  const res = await ghl<{ opportunity?: { id: string } }>("/opportunities/", {
    method: "POST",
    body: {
      locationId: locationId(),
      pipelineId: destino.id,
      pipelineStageId: faseId,
      name: nombreOportunidad(d),
      status: "open",
      contactId: contactoId,
      monetaryValue: d.valorEstimado ?? 0,
      customFields: [
        ...campo(CAMPO_OPORTUNIDAD.linea_negocio, ETIQUETA_LINEA[d.linea]),
        ...campo(CAMPO_OPORTUNIDAD.rol_jv, d.rolJV ? ETIQUETA_ROL[d.rolJV] : undefined),
        ...campo(CAMPO_OPORTUNIDAD.pain_declarado, d.pain),
        ...campoMulti(CAMPO_OPORTUNIDAD.procesos_criticos, d.procesos),
        ...campo(CAMPO_OPORTUNIDAD.ruta, d.ruta),
        // Sí/No explícito, no «Sí o nada»: la automatización filtra por
        // igualdad y un campo vacío no se distingue de un lead antiguo.
        ...campo(
          CAMPO_OPORTUNIDAD.info_inversores,
          d.infoInversores === undefined ? undefined : etiquetaInfoInversores(d.infoInversores),
        ),
        ...campo(
          CAMPO_OPORTUNIDAD.servicio,
          d.servicio ? ETIQUETA_SERVICIO[d.servicio] : undefined,
        ),
        ...campo(
          CAMPO_OPORTUNIDAD.modalidad,
          d.modalidad ? ETIQUETA_MODALIDAD[d.modalidad] : undefined,
        ),
        ...campo(
          CAMPO_OPORTUNIDAD.estado_presupuesto,
          ETIQUETA_ESTADO_PRESUPUESTO[d.estadoPresupuesto ?? ESTADO_PRESUPUESTO_INICIAL],
        ),
        ...campo(CAMPO_OPORTUNIDAD.uuid_app_comercial, d.uuid),
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